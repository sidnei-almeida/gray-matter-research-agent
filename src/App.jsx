import AppShell from './components/AppShell';
import AppHeader from './components/AppHeader';
import Sidebar from './components/Sidebar';
import ChatWorkspace from './components/ChatWorkspace';
import LabToolsPanel from './components/LabToolsPanel';
import { LabDialogProvider } from './context/LabDialogContext';
import { useConversations } from './hooks/useConversations';

function AppContent() {
  const {
    conversations,
    activeConversation,
    activeConversationId,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
    isSending,
    deepMode,
    setDeepMode,
    composerSuggestions,
  } = useConversations();

  return (
    <AppShell>
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onCreateConversation={createConversation}
        onDeleteConversation={deleteConversation}
      />
      <AppHeader />
      <ChatWorkspace
        conversation={activeConversation}
        onSend={sendMessage}
        isSending={isSending}
        deepMode={deepMode}
        onDeepModeChange={setDeepMode}
        composerSuggestions={composerSuggestions}
      />
      <LabToolsPanel onPromptSelect={sendMessage} />
    </AppShell>
  );
}

export default function App() {
  return (
    <LabDialogProvider>
      <AppContent />
    </LabDialogProvider>
  );
}
