import { Router } from "express";
import {resisterUser} from "../constrollers/user.controller.js"
const router = Router()

router.route("/register").post(resisterUser)
export default router;