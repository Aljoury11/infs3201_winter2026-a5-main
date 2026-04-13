const mailService = require("./emailSystem")

const recipient = "test@gmail.com"
const subjectLine = "Test Subject"
const content = "This is a test email"

mailService.sendEmail(recipient, subjectLine, content)