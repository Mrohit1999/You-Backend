import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadFile } from "../utils/cloudinary.js";
import { ApiRespones } from "../utils/ApiRespones.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";



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

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await User.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password")
  }
  user.password = newPassword

  await user.save(validateBeforeSave.false)

  return res
    .status(200)
    .json(new ApiRespones(200, {},
      "Password change Successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiRespones(200, req.user, "Current User Fatched"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body

  if (!fullname || !email) {
    throw new ApiError(400, "Fullname or Email is Required")
  }

  const user = await User.findByIdAndUpdate
    (req.user?._id,
      {
        $set: {
          fullname,
          email
        }
      },
      { new: true }
    ).select("-password")
  return res
    .status(200)
    .json(new ApiRespones(200, user, "Account Details Updated"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {

  const localAvatarPath = req.file?.path

  if (!localAvatarPath) {
    throw new ApiError(400, "Avatar file is missing")
  }

  const avatar = await uploadFile(localAvatarPath)

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading Avatar")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(
      new ApiRespones(200, user, "Avatar Updated")
    )

})

const updateCoverImage = asyncHandler(async (req, res) => {

  const localCoverImagePath = req.file?.path

  if (!localCoverImagePath) {
    throw new ApiError(400, "Cover image is missing")
  }

  const coverImage = await uploadFile(localCoverImagePath)

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading CoverImage")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(
      new ApiRespones(200, user, "CoverImage Updated")
    )

})

const getUserProfile = asyncHandler(async (req, res) => {

  const { username } = req.params

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing")
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelsSubscribeToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            $in: [req.user?._id, "$subscribers.subscriber"],
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        email: 1,
        subscribersCout: 1,
        channelsSubscribeToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
        avatar: 1

      }
    }
  ])
  console.log(channel)

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist")
  }
  return res
    .status(200)
    .json(
      new ApiRespones(200, channel[0], "User channel fetched."))
})

const getWatchHistory = asyncHandler(async (req, res) => {

  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res
    .status(200)
    .json(
      new ApiRespones(
        200, user[0].watchHistory,
        "User histoty fatched successfully"
      )
    )
})
export {
  resisterUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserProfile,
  getWatchHistory
};
