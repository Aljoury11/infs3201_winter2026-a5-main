const express = require('express')
const { engine } = require('express-handlebars')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const business = require('./business.js')
const app = express()

/**
 * Configure view engine and middleware.
 */
function setupApp() {
    app.engine('hbs', engine())
    app.set('view engine', 'hbs')
    app.set('views', path.join(__dirname, 'template'))

    app.use('/public', express.static(path.join(__dirname, 'static')))
    app.use(express.urlencoded({ extended: false }))
    app.use(cookieParser())
}

setupApp()



/**
 * Create multer storage configuration.
 */
const storageConfig = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads', req.params.eid)

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        cb(null, dir)
    },

    filename: function (req, file, cb) {
        const name = Date.now() + '-' + file.originalname
        cb(null, name)
    }
})

/**
 * Allow only PDF files.
 */
function validateFile(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
        cb(null, true)
    } else {
        cb(new Error('Only PDF files allowed'), false)
    }
}

/**
 * Multer instance.
 */
const uploader = multer({
    storage: storageConfig,
    fileFilter: validateFile,
    limits: { fileSize: 2 * 1024 * 1024 }
})



/**
 * Log all requests.
 */
app.use(async (req, res, next) => {
    const sid = req.cookies.session
    await business.logEvent(sid, req.url, req.method)
    next()
})



/**
 * Display login page.
 */
app.get('/login', (req, res) => {
    const msg = req.query.msg || ''

    res.render('login', {
        message: msg,
        layout: undefined
    })
})

/**
 * Handle login request.
 */
app.post('/login', async (req, res) => {
    const user = req.body.username
    const pass = req.body.password

    const result = await business.startSession(user, pass)

    if (!result) {
        return res.redirect('/login?msg=Invalid username/password')
    }

    if (result.twoFA) {
        return res.redirect('/two_factor?user=' + encodeURIComponent(result.user))
    }

    if (result.sessionId) {
        res.cookie('session', result.sessionId, {
            maxAge: result.duration * 1000,
            httpOnly: true
        })
        return res.redirect('/')
    }

    res.redirect('/login?msg=Unexpected error')
})



/**
 * Show 2FA page.
 */
app.get('/two_factor', (req, res) => {
    res.render('two_factor', {
        user: req.query.user || '',
        message: req.query.msg || '',
        layout: undefined
    })
})

/**
 * Validate 2FA code.
 */
app.post('/two_factor', async (req, res) => {
    const user = req.body.username
    const code = req.body.code

    const result = await business.verify2FACode(user, code)

    if (!result) {
        return res.redirect('/two_factor?user=' + encodeURIComponent(user) + '&msg=Invalid or expired code')
    }

    res.cookie('session', result.sessionId, {
        maxAge: result.duration * 1000,
        httpOnly: true
    })

    res.redirect('/')
})



/**
 * Logout user.
 */
app.get('/logout', (req, res) => {
    res.clearCookie('session')
    res.redirect('/login?msg=Logged out')
})



/**
 * Authentication middleware.
 */
app.use(async (req, res, next) => {
    const sid = req.cookies.session

    if (!sid) {
        return res.redirect('/login?msg=You must be logged in')
    }

    const isValid = await business.validSession(sid)

    if (!isValid) {
        res.clearCookie('session')
        return res.redirect('/login?msg=Session not valid')
    }

    const extra = await business.extendSession(sid)

    res.cookie('session', sid, {
        maxAge: extra * 1000,
        httpOnly: true
    })

    next()
})



/**
 * Home page.
 */
app.get('/', async (req, res) => {
    const list = await business.getAllEmployees()

    res.render('landing', {
        empList: list,
        layout: undefined
    })
})

/**
 * View one employee.
 */
app.get('/employee/:eid', async (req, res) => {
    const emp = await business.getEmployee(req.params.eid)
    const shifts = await business.getEmployeeShifts(req.params.eid)

    shifts.forEach(s => {
        s.startEarly = s.startTime < '12:00'
        s.endEarly = s.endTime < '12:00'
    })

    const dir = path.join(__dirname, 'uploads', req.params.eid)
    let files = fs.existsSync(dir) ? fs.readdirSync(dir) : []

    res.render('single_employee', {
        employeeDetails: emp,
        shifts,
        files,
        layout: undefined
    })
})

/**
 * Edit employee page.
 */
app.get('/edit/:eid', async (req, res) => {
    const emp = await business.getEmployee(req.params.eid)

    res.render('edit_employee', {
        employeeDetails: emp,
        layout: undefined
    })
})

/**
 * Update employee info.
 */
app.post('/update-employee', async (req, res) => {
    const id = req.body.id.trim()
    const name = req.body.name.trim()
    const phone = req.body.phone.trim()

    if (!name || !phone) {
        return res.send("Form inputs invalid")
    }

    const result = await business.updateEmployee({
        employeeId: id,
        employeeName: name,
        employeePhone: phone
    })

    result === "OK"
        ? res.redirect('/')
        : res.send("Error updating employee")
})



/**
 * Upload PDF for employee.
 */
app.post('/upload/:eid', (req, res) => {
    const dir = path.join(__dirname, 'uploads', req.params.eid)

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    const existing = fs.readdirSync(dir)

    if (existing.length >= 5) {
        return res.send("Maximum 5 documents are allowed")
    }

    uploader.single('document')(req, res, function (err) {
        if (err) {
            return res.send(err.message)
        }

        if (!req.file) {
            return res.send("No file uploaded")
        }

        console.log("File uploaded:", req.file.filename)
        res.redirect('/employee/' + req.params.eid)
    })
})



/**
 * Download employee file.
 */
app.get('/download/:eid/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.eid, req.params.filename)

    if (!fs.existsSync(file)) {
        return res.send("File not found")
    }

    res.download(file)
})



/**
 * Start server.
 */
app.listen(8000, () => {
    console.log("Server running at http://localhost:8000")
})
