/**
 * Simulate sending an email.
 * In this project, the email is displayed in the console.
 *
 * @param {string} recipient
 * @param {string} title
 * @param {string} body
 */
function sendEmail(recipient, title, body) {
    const separatorStart = "===== EMAIL BEGIN ====="
    const separatorEnd = "===== EMAIL FINISH ====="

    console.log(separatorStart)

    console.log("Recipient:", recipient)
    console.log("Title:", title)
    console.log("Content:", body)

    console.log(separatorEnd)
}

module.exports = {
    sendEmail: sendEmail
}
