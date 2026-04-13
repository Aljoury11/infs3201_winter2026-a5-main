const mongodb = require('mongodb')

let cachedClient = undefined

async function getDatabase() {
    if (cachedClient) {
        return cachedDb // already connected so use the cache
    }
    cachedClient = new mongodb.MongoClient('mongodb://60106404_db_user:AqjVWTUSnVh3FIsJ@ac-xs191vu-shard-00-00.tyuzuvd.mongodb.net:27017,ac-xs191vu-shard-00-01.tyuzuvd.mongodb.net:27017,ac-xs191vu-shard-00-02.tyuzuvd.mongodb.net:27017/infs3201_winter2026?ssl=true&replicaSet=atlas-o17ozs-shard-0&authSource=admin&retryWrites=true&w=majority')
    await cachedClient.connect()
    cachedDb = cachedClient.db('infs3201_winter2026')
    return cachedDb
}

async function closeDatabase() {
    cachedClient.close()
}

async function getEmployeeObjectId(empId) {
    let db = await getDatabase()
    let employeeCollection = db.collection('employees')
    let employee = await employeeCollection.findOne({employeeId: empId})
    return employee._id
}

async function getShiftObjectId(shiftId) {
    let db = await getDatabase()
    let shiftCollection = db.collection('shifts')
    let shift = await shiftCollection.findOne({shiftId: shiftId})
    return shift._id
}

async function loadEmployeesInShifts() {
    let db = await getDatabase()
    let assignmentsCollection = db.collection('assignments')
    let assignments = await assignmentsCollection.find().toArray()
    let shifts = db.collection('shifts')
    for (let asn of assignments) {
        console.log(asn)
        let employeeId = await getEmployeeObjectId(asn.employeeId)
        let shiftId = await getShiftObjectId(asn.shiftId)
        console.log(employeeId, shiftId)
        await shifts.updateOne(
            { _id: new mongodb.ObjectId(shiftId) },
            { $push: { employees: new mongodb.ObjectId(employeeId) } }
        )

    }
    await closeDatabase()
}

async function createEmptyListsInShifts() {
    let db = await getDatabase();
    let shifts = db.collection('shifts')
    await shifts.updateMany({}, {$set: { employees: []}})
    await closeDatabase()
}

//createEmptyListsInShifts()
loadEmployeesInShifts()

/*
clean up

db.employees.updateMany({}, {$unset: {employeeId: ""}})
db.shifts.updateMany({}, {$unset: {shiftId: ""}})
db.assignments.drop()
*/