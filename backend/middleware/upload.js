const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('../config/cloudinary')

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'reimbursements',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
})

const upload = multer({
  storage,
  limits: { files: 10, fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }), false)
    }
  },
})

module.exports = upload
