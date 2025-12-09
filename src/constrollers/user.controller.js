import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadFile } from "../utils/cloudinary.js";
import { ApiRespones } from "../utils/ApiRespones.js";
import jwt from "jsonwebtoken"
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  } catch (error) {
    throw new ApiError(500, "Something went wrong")
  }
}

const resisterUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  // console.log("BODY:", req.body);
  // console.log("FILES:", req.files);

  // validation
  if ([fullname, email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All the Fields Are Required!");
  }

  const userIsExisted = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userIsExisted) {
    throw new ApiError(409, "Username or Email is already exists!");
  }

  // safe access for files (no undefined[0] crash)
  const files = req.files || {};
  // console.log(req.files);

  const avatarLocalP =
    Array.isArray(files.avatar) && files.avatar.length > 0
      ? files.avatar[0].path
      : null;

  const coverImageLocalP =
    Array.isArray(files.coverImage) && files.coverImage.length > 0
      ? files.coverImage[0].path
      : null;

  if (!avatarLocalP) {
    throw new ApiError(400, "Avatar is Required!");
  }

  const avatar = await uploadFile(avatarLocalP);
  const coverImage = coverImageLocalP ? await uploadFile(coverImageLocalP) : null;

  if (!avatar) {
    throw new ApiError(500, "Cloudinary upload failed!");
  }

  const user = await User.create({
    // 👇 must match schema field name
    fullname: fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    username: username.toLowerCase(),
    password,
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res.status(201).json(
    new ApiRespones(201, userCreated, "User Registered Successfully.")
  );
});

const loginUser = asyncHandler(async (req, res) => {

  const { username, email, password } = req.body
  if (!username && !email) {
    throw new ApiError(400, "Username or password is required")
  }
  const user = await User.findOne({
    $or: [{ username }, { email }]
  })
  if (!user) {
    throw new ApiError(404, "User is not Register")
  }
  const isPasswordValid = await user.isPasswordCorrect(password)
  if (!isPasswordValid) {
    throw new ApiError(401, "Password Incorrect")
  }
  const { accessToken, refreshToken } = await
    generateAccessAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.
    status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiRespones(
        200,
        {
          user: loggedInUser, accessToken, refreshToken
        },
        "User Logged In Successfully"
      )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    }, {
    new: true
  }
  )
  const options = {
    httpOnly: true,
    secure: true
  }
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiRespones(200, {}, "User Logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request")
  }
  try {
    const decodedToken = jwt.verify(incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id)
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token")
    }
  
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is Expired or used")
    }
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const { accessToken, newrefreshToken } = await
      generateAccessAndRefreshToken(user._id)
  
    return res.
      status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newrefreshToken, options)
      .json(
        new ApiRespones(
          200,
          { accessToken, refreshToken: newrefreshToken }
        )
      )
  } catch (error) {
      throw new ApiError(401, error?.message || 
        "Invalid Refresh Token"
      )
  }
})
export {
  resisterUser,
  loginUser,
  logoutUser,
  refreshAccessToken
};
