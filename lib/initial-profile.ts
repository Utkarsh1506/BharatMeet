import { currentUser } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { redirect } from "next/navigation"; // Use Next.js's redirect for server-side

export const initialProfile = async () => {
  const user = await currentUser();

  if (!user) {
    // Redirect to the sign-in page using Next.js's redirect
    return redirect("/sign-in");
  }

  // Check if the profile already exists
  const profile = await db.profile.findUnique({
    where: {
      userId: user.id,
    },
  });

  if (profile) {
    return profile;
  }

  // Create a new profile if it doesn't exist
  const newProfile = await db.profile.create({
    data: {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      imageUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
    },
  });

  return newProfile;
};