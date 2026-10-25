import { redirect } from "next/navigation";

/**
 * The Circle home is now Community: the feed, friends, and circles as group
 * chats. This address forwards there so old links and the installed app's
 * shortcut still work.
 */
export default function CircleMoved() {
  redirect("/app/community");
}
