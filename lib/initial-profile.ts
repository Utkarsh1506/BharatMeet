import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

const buildProfileName = (user: Awaited<ReturnType<typeof currentUser>>) => {
  const firstName = user?.firstName?.trim();
  const lastName = user?.lastName?.trim();
  const username = user?.username?.trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  if (firstName) {
    return firstName;
  }

  if (lastName) {
    return lastName;
  }

  if (username) {
    return username;
  }

  return "New User";
};

export const initialProfile = async () => {
  const user = await currentUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Setup can be requested by overlapping server renders after sign-up.
  // Upsert makes profile initialization atomic and safe to retry.
  return db.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      name: buildProfileName(user),
      imageUrl: user.imageUrl,
      email: user.primaryEmailAddress?.emailAddress
        ?? user.emailAddresses[0]?.emailAddress
        ?? `${user.id}@local.user`,
    },
    update: {},
  });
};
