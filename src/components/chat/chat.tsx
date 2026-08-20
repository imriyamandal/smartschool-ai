'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, ShieldAlert, Cpu, CheckCircle, HelpCircle } from 'lucide-react';
import { AvatarState } from '../avatar/avatar';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  toolInfo?: {
    name: string;
    success?: boolean;
    statusText?: string;
  };
}

interface ChatProps {
  currentLanguage: string;
  onSendMessage: (text: string, pendingAction: any) => Promise<any>;
  avatarState: AvatarState;
  setAvatarState: (state: AvatarState) => void;
  onNewMessageLogged?: () => void; // Trigger callback to refresh audit logs
  chatTriggerText?: string | null;
  clearChatTrigger?: () => void;
}

export const Chat: React.FC<ChatProps> = ({
  currentLanguage,
  onSendMessage,
  avatarState,
  setAvatarState,
  onNewMessageLogged,
  chatTriggerText,
  clearChatTrigger
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentPendingAction, setCurrentPendingAction] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Trigger quick action message sending
  useEffect(() => {
    if (chatTriggerText) {
      handleSend(chatTriggerText);
      clearChatTrigger?.();
    }
  }, [chatTriggerText]);


  useEffect(() => {
    // Load initial greeting
    setMessages([
      {
        id: 'msg-init',
        role: 'ai',
        content: currentLanguage === 'Hindi' 
          ? 'नमस्ते! मैं स्कूल असिस्टेंट हूँ। मैं आज आपकी क्या मदद कर सकता हूँ?'
          : 'Hello! I am your School Assistant. How can I help you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [currentLanguage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend: string, isConfirmation = false) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setAvatarState('thinking');

    // Display temporary tool status text in UI if we know what tool will run
    let toolRunningText = '';
    if (currentPendingAction && isConfirmation && textToSend.toLowerCase() === 'yes') {
      toolRunningText = currentPendingAction.toolName === 'markAttendance' 
        ? 'Submitting attendance update...' 
        : 'Submitting escalation request...';
    }

    try {
      const result = await onSendMessage(textToSend, currentPendingAction);
      
      const aiMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        role: 'ai',
        content: result.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolInfo: result.toolName ? {
          name: result.toolName,
          success: result.toolResult?.success,
          statusText: result.toolResult?.success ? 'Success' : result.toolResult?.error
        } : undefined
      };

      setMessages(prev => [...prev, aiMsg]);
      setCurrentPendingAction(result.pendingAction); // Update confirmation state
      setAvatarState(result.pendingAction ? 'idle' : 'speaking');
      
      // Stop avatar speaking animation after 4 seconds for readability
      if (!result.pendingAction) {
        setTimeout(() => setAvatarState('idle'), 4000);
      }

      if (onNewMessageLogged) {
        onNewMessageLogged();
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-err-${Date.now()}`,
        role: 'ai',
        content: `Error: ${err.message || 'Server did not respond.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      setAvatarState('error');
      setTimeout(() => setAvatarState('idle'), 3000);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `msg-init-${Date.now()}`,
        role: 'ai',
        content: currentLanguage === 'Hindi' 
          ? 'नमस्ते! इतिहास साफ कर दिया गया है। मैं आज आपकी क्या सहायता कर सकता हूँ?'
          : 'Hello! Chat history cleared. How can I help you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setCurrentPendingAction(null);
    setAvatarState('idle');
  };

  return (
    <div className="flex flex-col h-[520px] bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">Assistant Conversation</h3>
        <button
          onClick={clearChat}
          className="p-1.5 hover:bg-zinc-850 hover:text-red-400 text-zinc-500 rounded transition"
          title="Clear Conversation"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Tool Execution status */}
            {msg.toolInfo && (
              <div className="flex items-center gap-1.5 px-3 py-1 mb-1.5 text-xs rounded-full bg-zinc-900 border border-zinc-850 max-w-[85%]">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-zinc-400">{msg.toolInfo.name}</span>
                <span className="text-zinc-500">|</span>
                {msg.toolInfo.success ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle className="w-3 h-3" /> Success
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-0.5">
                    <ShieldAlert className="w-3 h-3" /> {msg.toolInfo.statusText || 'Failed'}
                  </span>
                )}
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-md ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-none'
                  : 'bg-zinc-900 border border-zinc-800/80 text-zinc-100 rounded-tl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide block mt-1 text-right">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1.5 pl-2">
            <span className="w-2.5 h-2.5 bg-zinc-600 rounded-full animate-bounce" />
            <span className="w-2.5 h-2.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-2.5 h-2.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Awaiting Confirmation Quick Actions */}
      {currentPendingAction && currentPendingAction.status === 'awaiting_confirmation' && (
        <div className="flex flex-col gap-2 p-3 mb-2 bg-indigo-950/40 border border-indigo-900/40 rounded-xl">
          <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" /> Action Confirmation Required:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleSend('Yes', true)}
              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
            >
              Confirm & Proceed
            </button>
            <button
              onClick={() => handleSend('No', true)}
              className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend(inputValue);
        }}
        className="flex gap-2 pt-2 border-t border-zinc-850"
      >
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={
            currentPendingAction && currentPendingAction.status === 'awaiting_confirmation'
              ? "Type 'Yes' or 'No'..."
              : "Type your query here..."
          }
          className="flex-1 bg-zinc-900 border border-zinc-850 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isTyping}
          className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl shadow-lg shadow-violet-500/10 transition"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
    </div>
  );
};
