# Assignment 5 – Secure Employee Management System

## Overview

This project is a refactored version of Assignment 4 with additional security and file management features.

The system is a web-based employee management application built using Node.js, Express, MongoDB, and Handlebars.

It implements authentication, session management, two-factor authentication (2FA), secure file upload, and role-based access to protected resources.

---

## Technologies Used

- Node.js
- Express.js
- MongoDB Atlas
- Express Handlebars
- Multer (file upload)
- Cookie Parser

---

## Features

### Authentication & Security

- User login with username and password
- Password hashing using SHA-256
- Session-based authentication using cookies
- Session expiration and extension
- Secure logout (session deletion + cookie clearing)

### Two-Factor Authentication (2FA)

- 6-digit verification code
- Code sent via simulated email (console output)
- Code expires after 3 minutes
- Session created only after successful verification

### Login Protection

- Tracks failed login attempts
- Sends security alert after 3 failed attempts
- Locks account after 10 failed attempts

---

### Employee Management

- View all employees
- View employee details
- Edit employee information

---

### File Upload (Assignment Requirement)

- Upload documents for each employee
- Only PDF files allowed
- Maximum file size: 2MB
- Maximum 5 files per employee
- Files stored in filesystem (not database)
- Files are NOT publicly accessible

---

### Secure File Access

- Uploaded files listed per employee
- Files can be downloaded via protected routes
- Access requires valid session

---

Username: admin
Password: adminpass
