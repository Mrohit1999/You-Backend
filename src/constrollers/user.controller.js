import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadFile } from "../utils/cloudinary.js"
import {ApiRespones} from "../utils/ApiRespones.js"
const resisterUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body
    console.log("email:", email)

    if (
        [fullName, email, username, password].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All the Fields Are Required!")
    }

    const userIsExisted = User.findOne({
        $or: [{ username }, { email }]
    })

    if (userIsExisted) {
        throw new ApiError(409, "Username or Email is already exists!")
    }

    const avatarLocalP = req.files?.avatar[0]?.path
    const coverImageLocalP = req / files?.coverImage[0]?.path

    if (!avatarLocalP) {
        throw new ApiError(400, "Avatar is Required!")
    }

    const avatar = await uploadFile(avatarLocalP)
    const coverImage = await uploadFile(coverImageLocalP)

    if (!avatar) {
        throw new ApiError(400, "Avatar is Required!")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLocalCase(),
        password
    }
    )
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!userCreated){
        throw new ApiError(500, "Something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiRespones(200, userCreated, "User Registered Successfully.")
    )
})


export { resisterUser };