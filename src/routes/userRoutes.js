import { Router } from "express";
import { loginUser, logoutUser, resisterUser } from "../constrollers/user.controller.js";
import { upload } from "../middlewares/multer.js";
import  {verifyJWT}  from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register")
  .post(
    upload.fields([
      { name: "avatar", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
    ]),
    resisterUser
  );

router.route("/login").post(loginUser)

//secure routes
router.route("/logout").post(verifyJWT,logoutUser)
export default router;
