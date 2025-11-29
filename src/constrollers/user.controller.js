import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadFile } from "../utils/cloudinary.js";
import { ApiRespones } from "../utils/ApiRespones.js";

const resisterUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  console.log("BODY:", req.body);
  console.log("FILES:", req.files);

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

export { resisterUser };
