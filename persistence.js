const fs = require('fs/promises')
const { MongoClient, ObjectId } = require('mongodb')
const crypto = require('crypto')
let clientCache = null
let databaseCache = null

async function getDatabase() {
    if (databaseCache !== null) {
        return databaseCache
    }

    const uri = 'mongodb://60106404_db_user:AqjVWTUSnVh3FIsJ@ac-xs191vu-shard-00-00.tyuzuvd.mongodb.net:27017,ac-xs191vu-shard-00-01.tyuzuvd.mongodb.net:27017,ac-xs191vu-shard-00-02.tyuzuvd.mongodb.net:27017/infs3201_winter2026?ssl=true&replicaSet=atlas-o17ozs-shard-0&authSource=admin&retryWrites=true&w=majority'

    clientCache = new MongoClient(uri)
    await clientCache.connect()

    databaseCache = clientCache.db('infs3201_winter2026')
    return databaseCache
}

async function disconnectDatabase() {
    if (clientCache) {
        await clientCache.close()
    }
}

/* ================= EMPLOYEES ================= */

async function getAllEmployees() {
    const db = await getDatabase()
    const col = db.collection('employees')
    const cursor = col.find()
    return await cursor.toArray()
}

async function findEmployee(empId) {
    const db = await getDatabase()
    const col = db.collection('employees')
    return await col.findOne({ _id: new ObjectId(empId) })
}

async function addEmployeeRecord(emp) {
    const db = await getDatabase()
    const col = db.collection('employees')

    const agg = await col.aggregate([
        {
            $project: {
                num: {
                    $toInt: { $substr: ["$employeeId", 1, -1] }
                }
            }
        },
        {
            $group: {
                _id: null,
                max: { $max: "$num" }
            }
        }
    ]).toArray()

    const next = agg[0].max + 1
    emp.employeeId = "E" + String(next).padStart(3, '0')

    await col.insertOne(emp)
}

async function updateEmployee(emp) {
    const db = await getDatabase()
    const col = db.collection('employees')

    const mongoId = new ObjectId(emp.employeeId)

    await col.updateOne(
        { _id: mongoId },
        {
            $set: {
                name: emp.employeeName,
                phone: emp.employeePhone
            }
        }
    )

    return "OK"
}

/* ================= SHIFTS ================= */

async function findShift(shiftId) {
    const db = await getDatabase()
    return await db.collection('shifts').findOne({ shiftId: shiftId })
}

async function getEmployeeShifts(empId) {
    const db = await getDatabase()
    const id = new ObjectId(empId)

    return await db.collection('shifts')
        .find({ employees: id })
        .toArray()
}

/* ================= AUTH ================= */

async function checkCredentials(username, password) {
    const hashed = crypto.createHash('sha256')
        .update(password)
        .digest('hex')

    const db = await getDatabase()
    const user = await db.collection('users').findOne({
        user: username,
        password: hashed
    })

    return user !== null
}

async function findUser(username) {
    const db = await getDatabase()
    return await db.collection('users').findOne({ user: username })
}

async function incrementFailedLogin(username) {
    const db = await getDatabase()
    const col = db.collection('users')

    await col.updateOne(
        { user: username },
        { $inc: { failedLoginAttempts: 1 } }
    )

    const updated = await col.findOne({ user: username })
    return updated.failedLoginAttempts
}

async function resetFailedLogin(username) {
    const db = await getDatabase()
    await db.collection('users').updateOne(
        { user: username },
        { $set: { failedLoginAttempts: 0 } }
    )
}

async function lockUserAccount(username) {
    const db = await getDatabase()
    await db.collection('users').updateOne(
        { user: username },
        { $set: { disabled: true } }
    )
}

/* ================= SESSION ================= */

async function createSession(sessionId, timeout, data) {
    const db = await getDatabase()
    const expiry = new Date(Date.now() + timeout * 1000)

    await db.collection('sessions').insertOne({
        id: sessionId,
        expiry: expiry,
        data: data
    })
}

async function getSessionData(sessionId) {
    const db = await getDatabase()
    const session = await db.collection('sessions').findOne({ id: sessionId })

    return session ? session.data : null
}

async function extendSession(sessionId, seconds) {
    const db = await getDatabase()
    const newTime = new Date(Date.now() + seconds * 1000)

    const result = await db.collection('sessions').updateOne(
        { id: sessionId },
        { $set: { expiry: newTime } }
    )

    return result.modifiedCount === 1
}

/* ================= LOG ================= */

async function logEvent(username, url, method) {
    const db = await getDatabase()

    await db.collection('security_log').insertOne({
        timestamp: new Date(),
        username: username,
        url: url,
        method: method
    })
}

module.exports = {
    getAllEmployees,
    findEmployee,
    addEmployeeRecord,
    updateEmployee,
    findShift,
    getEmployeeShifts,
    disconnectDatabase,
    checkCredentials,
    createSession,
    getSessionData,
    extendSession,
    logEvent,
    findUser,
    incrementFailedLogin,
    resetFailedLogin,
    lockUserAccount
}
