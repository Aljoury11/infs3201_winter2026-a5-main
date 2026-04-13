const persistence = require('./persistence.js')
const crypto = require('crypto')
const emailSystem = require('./emailSystem')
/**
 * In-memory storage for pending 2FA verification codes.
 * Format:
 * {
 *   username: {
 *     code: number,
 *     expires: number
 *   }
 * }
 */
let twoFactorStore = {}

/**
 * Load and return all employees.
 * @returns {Array<{ employeeId: string, name: string, phone: string }>}
 */
async function getAllEmployees() {
    const employees = await persistence.getAllEmployees()
    return employees
}

/**
 * Find one employee by ID.
 * @param {string} id
 * @returns {Object|null}
 */
async function getEmployee(id) {
    const employee = await persistence.findEmployee(id)
    return employee
}

/**
 * Start login flow:
 * - check user existence
 * - reject disabled users
 * - validate password
 * - handle failed attempts and lock policy
 * - generate and email 2FA code on success
 *
 * @param {string} username
 * @param {string} password
 * @returns {Object|null}
 */
async function startSession(username, password) {
    const account = await persistence.findUser(username)

    if (account === null) {
        return null
    }

    if (account.disabled === true) {
        return null
    }

    const passwordMatches = await persistence.checkCredentials(username, password)

    if (passwordMatches === false) {
        const failedAttempts = await persistence.incrementFailedLogin(username)

        if (failedAttempts === 3) {
            emailSystem.sendEmail(
                account.email,
                'Security Alert',
                'There have been multiple failed login attempts on your account.'
            )
        }

        if (failedAttempts >= 10) {
            await persistence.lockUserAccount(username)
        }

        return null
    }

    await persistence.resetFailedLogin(username)

    const verificationCode = Math.floor(100000 + Math.random() * 900000)
    const expirationTime = Date.now() + (3 * 60 * 1000)

    twoFactorStore[username] = {
        code: verificationCode,
        expires: expirationTime
    }

    emailSystem.sendEmail(
        account.email,
        'Your 2FA Code',
        'Your verification code is: ' + verificationCode
    )

    return {
        twoFA: true,
        user: username
    }
}

/**
 * Validate submitted 2FA code and create session if accepted.
 *
 * @param {string} username
 * @param {string|number} inputCode
 * @returns {{sessionId: string, duration: number}|null}
 */
async function verify2FACode(username, inputCode) {
    const savedRecord = twoFactorStore[username]

    if (savedRecord === undefined) {
        return null
    }

    const expired = Date.now() > savedRecord.expires
    if (expired) {
        delete twoFactorStore[username]
        return null
    }

    const sameCode = String(savedRecord.code) === String(inputCode)
    if (!sameCode) {
        return null
    }

    const newSessionId = crypto.randomUUID()
    const sessionDuration = 5 * 60

    await persistence.createSession(newSessionId, sessionDuration, {
        user: username
    })

    delete twoFactorStore[username]

    return {
        sessionId: newSessionId,
        duration: sessionDuration
    }
}

/**
 * Check whether a session exists and is valid.
 * @param {string} sessionId
 * @returns {boolean}
 */
async function validSession(sessionId) {
    const session = await persistence.getSessionData(sessionId)
    return session !== null
}

/**
 * Extend an active session.
 * @param {string} sessionId
 * @returns {number}
 */
async function extendSession(sessionId) {
    const extraSeconds = 5 * 60
    await persistence.extendSession(sessionId, extraSeconds)
    return extraSeconds
}

/**
 * Store a security event in logs.
 * @param {string} sessionId
 * @param {string} url
 * @param {string} method
 */
async function logEvent(sessionId, url, method) {
    const session = await persistence.getSessionData(sessionId)
    let username = ''

    if (session !== null) {
        username = session.user
    }

    await persistence.logEvent(username, url, method)
}

/**
 * Return all shifts for one employee.
 * @param {string} empId
 * @returns {Array}
 */
async function getEmployeeShifts(empId) {
    const shifts = await persistence.getEmployeeShifts(empId)
    return shifts
}

/**
 * Insert a new employee record.
 * @param {{name: string, phone: string}} emp
 */
async function addEmployeeRecord(emp) {
    const result = await persistence.addEmployeeRecord(emp)
    return result
}

/**
 * Assign an employee to a shift if all business rules pass.
 * @param {string} empId
 * @param {string} shiftId
 * @returns {string}
 */
async function assignShift(empId, shiftId) {
    const foundEmployee = await persistence.findEmployee(empId)
    if (foundEmployee === null) {
        return 'Employee does not exist'
    }

    const foundShift = await persistence.findShift(shiftId)
    if (foundShift === null) {
        return 'Shift does not exist'
    }

    const existingAssignment = await persistence.findAssignment(empId, shiftId)
    if (existingAssignment) {
        return 'Employee already assigned to shift'
    }

    const allowedHoursPerDay = await persistence.getDailyMaxHours()
    const shiftsOnSameDate = await persistence.getEmployeeShiftsOnDate(empId, foundShift.date)
    const requestedShiftHours = computeShiftDuration(foundShift.startTime, foundShift.endTime)

    let totalHoursForDate = 0

    for (const oneShift of shiftsOnSameDate) {
        totalHoursForDate = totalHoursForDate + computeShiftDuration(oneShift.startTime, oneShift.endTime)
    }

    const totalAfterAssignment = totalHoursForDate + requestedShiftHours

    if (totalAfterAssignment > allowedHoursPerDay) {
        return 'Hour Violation'
    }

    await persistence.addAssignment(empId, shiftId)

    return 'Ok'
}

/**
 * Calculate duration of a shift in hours.
 * @param {string} startTime
 * @param {string} endTime
 * @returns {number}
 */
function computeShiftDuration(startTime, endTime) {
    const startParts = startTime.split(':')
    const endParts = endTime.split(':')

    const startHour = Number(startParts[0])
    const startMinute = Number(startParts[1])
    const endHour = Number(endParts[0])
    const endMinute = Number(endParts[1])

    const startInMinutes = (startHour * 60) + startMinute
    const endInMinutes = (endHour * 60) + endMinute

    return (endInMinutes - startInMinutes) / 60
}

/**
 * Close database connection.
 */
async function disconnectDatabase() {
    await persistence.disconnectDatabase()
}

/**
 * Update one employee.
 * @param {Object} emp
 */
async function updateEmployee(emp) {
    const result = await persistence.updateEmployee(emp)
    return result
}

module.exports = {
    getAllEmployees: getAllEmployees,
    getEmployee: getEmployee,
    startSession: startSession,
    verify2FACode: verify2FACode,
    validSession: validSession,
    extendSession: extendSession,
    logEvent: logEvent,
    getEmployeeShifts: getEmployeeShifts,
    addEmployeeRecord: addEmployeeRecord,
    assignShift: assignShift,
    disconnectDatabase: disconnectDatabase,
    updateEmployee: updateEmployee
}
