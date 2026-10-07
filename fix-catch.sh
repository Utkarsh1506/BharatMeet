#!/bin/bash
sed -i 's/apiLogger.error({ error, messageId, serverId, channelId }/apiLogger.error({ error, ...req.query }/g' "pages/api/socket/messages/[messageId].ts"
sed -i 's/apiLogger.error({ error, serverId, channelId }/apiLogger.error({ error, ...req.query }/g' "pages/api/socket/messages/index.ts"
sed -i 's/apiLogger.error({ error, directMessageId, conversationId }/apiLogger.error({ error, ...req.query }/g' "pages/api/socket/direct-messages/[directMessageId].ts"
sed -i 's/apiLogger.error({ error, conversationId }/apiLogger.error({ error, ...req.query }/g' "pages/api/socket/direct-messages/index.ts"
