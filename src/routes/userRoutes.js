import { Router } from "express";
import { resisterUser } from "../constrollers/user.controller.js"
import { upload } from "../middlewares/multer.js"
const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    resisterUser
)
export default router;