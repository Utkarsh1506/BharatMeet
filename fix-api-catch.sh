#!/bin/bash
FILES=(
  "pages/api/socket/direct-messages/[directMessageId].ts"
  "pages/api/socket/direct-messages/index.ts"
  "pages/api/socket/messages/[messageId].ts"
  "pages/api/socket/messages/index.ts"
)
for file in "${FILES[@]}"; do
  # Declare variables before try
  sed -i 's/try {/let messageId, serverId, channelId, conversationId, directMessageId;\n  try {/g' "$file"
  # Change const/let destruction to simple assignment if inside try!
  # Actually, simpler: just remove them from catch block
done
