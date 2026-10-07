#!/bin/bash
FILES=(
  "app/api/messages/route.ts"
  "app/api/direct-messages/route.ts"
  "pages/api/socket/messages/index.ts"
  "pages/api/socket/messages/[messageId].ts"
  "pages/api/socket/direct-messages/index.ts"
  "pages/api/socket/direct-messages/[directMessageId].ts"
)
for file in "${FILES[@]}"; do
  sed -i 's/profile: true/profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } }/g' "$file"
done
