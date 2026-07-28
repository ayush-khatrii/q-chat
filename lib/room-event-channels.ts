export function ownerRequestEventsChannel(userId: string) {
  return `qchat:owner-requests:${userId}`;
}

export function userRequestStatusChannel(userId: string) {
  return `qchat:request-status:${userId}`;
}
