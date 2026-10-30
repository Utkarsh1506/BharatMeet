import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { dbLogger } from "@/lib/logger";

export const currentProfile = async () => {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  try {
    const profile = await db.profile.findUnique({
      where: {
        userId
      }
    });

    return profile;
  } catch (error) {
    dbLogger.error({ err: error, userId }, "Failed to load the signed-in user's profile");
    throw error;
  }
}
