import { create } from "zustand";

interface ReplyData {
  id: string;
  content: string;
  fileUrl?: string | null;
  memberName: string;
}

interface ReplyStore {
  isReplying: boolean;
  replyData: ReplyData | null;
  onReply: (data: ReplyData) => void;
  onCancel: () => void;
}

export const useReplyStore = create<ReplyStore>((set) => ({
  isReplying: false,
  replyData: null,
  onReply: (data) => set({ isReplying: true, replyData: data }),
  onCancel: () => set({ isReplying: false, replyData: null }),
}));
