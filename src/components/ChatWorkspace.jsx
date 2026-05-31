import MessageList from './MessageList';
import Composer from './Composer';

export default function ChatWorkspace({
  conversation,
  onSend,
  isSending,
  deepMode,
  onDeepModeChange,
  composerSuggestions = [],
}) {
  return (
    <main className="chat-workspace">
      <MessageList conversation={conversation} onFollowUpSelect={(text) => onSend(text, { deep: deepMode })} />
      <Composer
        onSend={onSend}
        loading={isSending}
        deepMode={deepMode}
        onDeepModeChange={onDeepModeChange}
        dynamicSuggestions={composerSuggestions}
      />
    </main>
  );
}
