"use client";

import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";

export const ImageLightboxModal = () => {
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "imageLightbox";
  const { imageUrl } = data;

  if (!imageUrl) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] w-auto h-auto bg-transparent border-none shadow-none flex justify-center items-center p-0 [&>button]:hidden">
        <div className="relative w-full h-full max-w-[90vw] max-h-[90vh] flex justify-center items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Attachment full screen"
            className="object-contain max-w-full max-h-[90vh] rounded-md shadow-2xl"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
