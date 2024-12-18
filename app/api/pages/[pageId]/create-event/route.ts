import { NextResponse } from "next/server";
import Event from "@/lib/models/Event";
import { connectToDB } from "@/mongodb/mongoose";
import { auth } from "@clerk/nextjs/server";
import { writeFile } from "fs/promises";
import path from "path";
import generateObjectId from "@/app/utils/objectIdUtil"; // Use the hashing utility
import Page from "@/lib/models/Page";

// Disable automatic body parsing by Next.js
export const config = {
  api: {
    bodyParser: false, // Disable Next.js's body parser so we can handle it manually
  },
};

// Utility function to save uploaded files
const saveFile = async (
  file: File | null,
  folder: string
): Promise<string | null> => {
  if (!file) return null;

  const currentWorkingDirectory = process.cwd();

  // Generate a unique file name using timestamp and file name
  const uniqueFileName = `${Date.now()}-${file.name}`;

  // Validate file type and size (example: allowing only images under 5MB)
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    console.error("Invalid file type:", file.type);
    throw new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed.");
  }
  if (file.size > 5 * 1024 * 1024) {
    // 5MB limit
    console.error("File size exceeds 5MB:", file.size);
    throw new Error("File size exceeds the 5MB limit.");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Path where the file will be saved
  const filePath = path.join(
    currentWorkingDirectory,
    "public",
    "uploads",
    folder,
    uniqueFileName
  );

  try {
    await writeFile(filePath, buffer);
    console.log("File saved to:", filePath);
    return `/uploads/${folder}/${uniqueFileName}`;
  } catch (error) {
    console.error("Error saving file:", error);
    throw new Error("Error saving file.");
  }
};

export const POST = async (
  req: Request,
  context: { params: Promise<{ pageId: string }> } // Adjusted type to expect a Promise for params
): Promise<Response> => {
  try {
    // Await params before accessing the pageId
    const { pageId } = await context.params; // Await params

    // Authentication with Clerk
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const department = formData.get("department") as string | null;
    const image = formData.get("image") as File | null;
    const date = formData.get("date") as string | null;
    const time = formData.get("time") as string | null;

    // Validate required fields
    if (!title || !description || !date || !time) {
      return new NextResponse(
        "Title, Description, Date, and Time are required",
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDB();

    // Convert userId to a valid ObjectId
    const creatorId = generateObjectId(userId);

    // Combine date and time into a single Date object
    const dateTimeString = `${date}T${time}:00`;
    const eventDate = new Date(dateTimeString);

    // Fetch the page by pageId
    const currentPage = await Page.findById(pageId);
    if (!currentPage) {
      return new NextResponse("Page not found", { status: 400 });
    }

    // Save the image, if present
    const imageUrl = image ? await saveFile(image, "postImages") : null;

    // Create the event in the database
    const event = await Event.create({
      creator: creatorId,
      page: currentPage._id,
      title,
      description,
      department,
      image: imageUrl,
      date: eventDate,
    });

    // Update the page with the new event
    await Page.findByIdAndUpdate(
      pageId,
      { $push: { events: event._id } },
      { new: true }
    );

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
};
