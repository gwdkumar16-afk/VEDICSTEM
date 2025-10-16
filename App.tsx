
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Send, Paperclip, ThumbsUp, ThumbsDown, RefreshCw, Copy, Share2, Plus, Search, Menu, Settings, User, MessageSquare, Clock, Pin, Check, Camera, MoreVertical, Trash2 } from 'lucide-react';
import { GoogleGenAI, Chat } from '@google/genai';

type Message = {
    id: number;
    type: 'user' | 'bot';
    content: string;
    feedback?: 'Like' | 'Dislike' | null;
    isLoading?: boolean;
};

// CONFIG SECTION: Centralized theme (easy to tweak colors here without UI changes)
const themeConfig = (darkMode: boolean) => ({
  bgColor: darkMode ? 'bg-black' : 'bg-white',
  textColor: darkMode ? 'text-white' : 'text-black',
  borderColor: darkMode ? 'border-white' : 'border-black',
  hoverBg: darkMode ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white',
  messageBg: darkMode ? 'bg-white text-black' : 'bg-black text-white',
  shadow: darkMode ? 'shadow-white/30' : 'shadow-black/30'
});

// HOOK SECTION: All logic handlers (update callbacks here for functionality changes)
const useChatHandlers = (
    messages: Message[], 
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>, 
    message: string, 
    setMessage: React.Dispatch<React.SetStateAction<string>>,
    isLoading: boolean,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    chatRef: React.MutableRefObject<Chat | null>
) => {
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    const newMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: message.trim()
    };
    
    setMessages(prev => [
        ...prev, 
        newMessage, 
        { id: Date.now() + 1, type: 'bot', content: '', isLoading: true }
    ]);
    setMessage('');
    
    try {
        if (!chatRef.current) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            // Reconstruct history for the chat session from initial messages
            const history = messages.map(msg => ({
                role: msg.type === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            chatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                history: history,
            });
        }
        
        const response = await chatRef.current.sendMessage({ message: newMessage.content });
        const aiResponseText = response.text;

        setMessages(prev => prev.map(msg => 
            msg.isLoading ? { ...msg, content: aiResponseText, isLoading: false } : msg
        ));

    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        setMessages(prev => prev.map(msg => 
            msg.isLoading ? { ...msg, content: "Sorry, I encountered an error. Please try again.", isLoading: false } : msg
        ));
    } finally {
        setIsLoading(false);
    }
  }, [message, messages, isLoading, setMessages, setMessage, setIsLoading, chatRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setMessage('');
    chatRef.current = null;
  }, [setMessages, setMessage, chatRef]);

  const handleRegenerate = useCallback((messageId: number) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: `[REGENERATED] ${msg.content.replace('[REGENERATED] ', '')}` }
        : msg
    ));
  }, [setMessages]);

  const handleCopy = useCallback((content: string) => {
    return navigator.clipboard.writeText(content);
  }, []);

  const handleFeedback = useCallback((messageId: number, feedbackType: 'Like' | 'Dislike') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback: msg.feedback === feedbackType ? null : feedbackType } : msg
    ));
  }, [setMessages]);

  const handleShare = useCallback((content: string) => {
    if (navigator.share) {
        navigator.share({
            title: 'VedicSTEM AI Chat',
            text: content,
        }).catch(console.error);
    } else {
        handleCopy(content).then(() => {
            alert('Content copied to clipboard. You can now share it.');
        });
    }
  }, [handleCopy]);

  const handleNavigation = useCallback((section: string, setActiveSection: React.Dispatch<React.SetStateAction<string>>) => {
    setActiveSection(section);
  }, []);

  const handleAttachment = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        const files = Array.from(target.files);
        console.log('Files selected:', files.map(f => f.name));
      }
    };
    input.click();
  }, []);
  
  const handleScreenshot = useCallback(async () => {
    try {
        // FIX: The 'cursor' property is valid for getDisplayMedia, but may be missing from default TypeScript type definitions. Casting the constraint to 'any' bypasses this type error.
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" } as any,
            audio: false,
        });

        const track = stream.getVideoTracks()[0];
        // @ts-ignore
        const imageCapture = new ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        
        track.stop();

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        }

        canvas.toBlob(blob => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'vedicstem-screenshot.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }, 'image/png');

    } catch (err) {
        console.error("Error capturing screenshot:", err);
    }
  }, []);

  return {
    handleSendMessage,
    handleKeyDown,
    handleNewChat,
    handleRegenerate,
    handleCopy,
    handleFeedback,
    handleShare,
    handleNavigation,
    handleAttachment,
    handleScreenshot
  };
};

// SUB-COMPONENT: Sidebar (edit layout/icons here)
// FIX: Refactored to define sidebar items with an explicit type. This resolves errors where `onClick` and `isAction` were destructured from objects that did not have them in their inferred type.
const Sidebar: React.FC<{
    sidebarOpen: boolean;
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    activeSection: string;
    setActiveSection: React.Dispatch<React.SetStateAction<string>>;
    handleNewChat: () => void;
    theme: ReturnType<typeof themeConfig>;
    handleNavigation: (section: string, setActiveSection: React.Dispatch<React.SetStateAction<string>>) => void;
}> = ({ sidebarOpen, setSidebarOpen, searchQuery, setSearchQuery, activeSection, setActiveSection, handleNewChat, theme, handleNavigation }) => {
  const sidebarItems: { icon: React.ElementType; label: string; onClick?: () => void; isAction?: boolean }[] = [
    { icon: Settings, label: 'Settings' },
    { icon: User, label: 'Profile' },
    { icon: Pin, label: 'Pinned Chats' },
    { icon: Clock, label: 'History' },
  ];
  
  return (
    <div 
      className={`${sidebarOpen ? 'w-64 p-3' : 'w-0 p-0'} transition-all duration-300 ${theme.borderColor} border-r flex flex-col overflow-hidden fixed left-0 top-0 h-full z-40 ${theme.bgColor}`}
      onMouseLeave={() => setSidebarOpen(false)}
    >
      <div className="pt-16 space-y-2" style={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full border ${theme.borderColor}`}>
          <Search size={16} className="opacity-60" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder-current opacity-60"
          />
        </div>

        {sidebarItems.map(({ icon: Icon, label, onClick, isAction }) => (
          <button 
            key={label}
            onClick={onClick || (() => handleNavigation(label, setActiveSection))}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${theme.hoverBg} transition-colors ${activeSection === label && !isAction ? (theme.bgColor === 'bg-black' ? 'bg-white/20' : 'bg-black/10') : ''}`}
          >
            <Icon size={20} />
            <span className="text-sm font-medium whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />

    </div>
  );
};

// SUB-COMPONENT: MessageItem (edit message rendering/actions here)
const MessageItem: React.FC<{
    msg: Message;
    theme: ReturnType<typeof themeConfig>;
    handleRegenerate: (id: number) => void;
    handleCopy: (content: string) => Promise<void>;
    handleFeedback: (id: number, type: 'Like' | 'Dislike') => void;
    handleShare: (content: string) => void;
}> = ({ msg, theme, handleRegenerate, handleCopy, handleFeedback, handleShare }) => {
    const [isCopied, setIsCopied] = useState(false);

    const onCopy = (content: string) => {
        handleCopy(content).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    }

    return (
        <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-3xl group">
                <div className={`${msg.type === 'user' ? theme.messageBg : `border ${theme.borderColor}`} px-6 py-4 rounded-lg`}>
                {msg.isLoading ? (
                    <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 bg-current rounded-full animate-pulse-fast" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-2 w-2 bg-current rounded-full animate-pulse-fast" style={{ animationDelay: '250ms' }}></span>
                        <span className="h-2 w-2 bg-current rounded-full animate-pulse-fast" style={{ animationDelay: '500ms' }}></span>
                    </div>
                ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
                </div>
                
                {msg.type === 'bot' && !msg.isLoading && (
                    <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleFeedback(msg.id, 'Like')} className={`p-2 rounded-lg ${theme.hoverBg} transition-colors ${msg.feedback === 'Like' ? (theme.textColor === 'text-white' ? 'bg-green-500/50' : 'bg-green-500/20') : ''}`} title="Like"><ThumbsUp size={16} /></button>
                        <button onClick={() => handleFeedback(msg.id, 'Dislike')} className={`p-2 rounded-lg ${theme.hoverBg} transition-colors ${msg.feedback === 'Dislike' ? (theme.textColor === 'text-white' ? 'bg-red-500/50' : 'bg-red-500/20') : ''}`} title="Dislike"><ThumbsDown size={16} /></button>
                        <button onClick={() => handleRegenerate(msg.id)} className={`p-2 rounded-lg ${theme.hoverBg} transition-colors`} title="Regenerate"><RefreshCw size={16} /></button>
                        <button onClick={() => onCopy(msg.content)} className={`p-2 rounded-lg ${theme.hoverBg} transition-colors`} title={isCopied ? "Copied!" : "Copy"}>{isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}</button>
                        <button onClick={() => handleShare(msg.content)} className={`p-2 rounded-lg ${theme.hoverBg} transition-colors`} title="Share"><Share2 size={16} /></button>
                    </div>
                )}
            </div>
        </div>
    );
};

// SUB-COMPONENT: ChatInput (edit input/attachments here)
const ChatInput: React.FC<{
    message: string;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    handleAttachment: () => void;
    handleSendMessage: () => void;
    handleScreenshot: () => void;
    theme: ReturnType<typeof themeConfig>;
    isLoading: boolean;
}> = ({ message, setMessage, handleKeyDown, handleAttachment, handleSendMessage, handleScreenshot, theme, isLoading }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    return (
      <div className={`flex items-end gap-3 rounded-lg border-2 ${theme.borderColor} shadow-lg ${theme.shadow} p-3 w-full max-w-4xl mx-auto`}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask VEDICSTEM anything..."
          className="flex-1 bg-transparent outline-none resize-none placeholder-current opacity-50 min-h-[24px] max-h-32"
          rows={1}
          disabled={isLoading}
        />
        <button 
          onClick={handleAttachment}
          className={`p-2 rounded-lg ${theme.hoverBg} transition-colors`} 
          title="Attach File"
          disabled={isLoading}
        >
          <Paperclip size={20} />
        </button>
         <button 
          onClick={handleScreenshot}
          className={`p-2 rounded-lg ${theme.hoverBg} transition-colors`} 
          title="Capture Screenshot"
          disabled={isLoading}
        >
          <Camera size={20} />
        </button>
        <button 
          onClick={handleSendMessage}
          className={`p-2 rounded-lg ${theme.messageBg} transition-colors disabled:opacity-50`} 
          title="Send"
          disabled={!message.trim() || isLoading}
        >
          <Send size={20} />
        </button>
      </div>
    );
};


const LogoIcon = ({ size = 28, className = '' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 90 104"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        fill="currentColor"
    >
        <path d="
            M45 0 L67.5 13 L45 26 L22.5 13 Z
            M22.5 13 L0 26 L22.5 39 L45 26 Z
            M67.5 13 L90 26 L67.5 39 L45 26 Z
            M22.5 65 L0 78 L22.5 91 L45 78 Z
            M67.5 65 L90 78 L67.5 91 L45 78 Z
            M45 104 L67.5 91 L45 78 L22.5 91 Z
            M45 26 L67.5 39 L45 52 L22.5 39 Z
            M22.5 39 L45 52 L22.5 65 L0 52 Z
            M67.5 39 L90 52 L67.5 65 L45 52 Z
        "/>
    </svg>
);


// MAIN COMPONENT: Orchestrator (core state + assembly; minimal changes)
export default function App() {
  // State management
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const chatRef = useRef<Chat | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'user',
      content: 'What is VEDICSTEM and how does it integrate traditional knowledge with modern science?'
    },
    {
      id: 2,
      type: 'bot',
      content: 'VEDICSTEM is an innovative approach that bridges ancient Vedic wisdom with contemporary STEM (Science, Technology, Engineering, and Mathematics) education. It explores how traditional Indian knowledge systems, including mathematics, astronomy, medicine, and engineering principles found in ancient texts, align with and complement modern scientific understanding. This integration helps students appreciate the rich scientific heritage while applying it to solve contemporary challenges.'
    }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('History');

  // Memoized theme (from config)
  const theme = useMemo(() => themeConfig(darkMode), [darkMode]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handlers
  const handlePinChat = useCallback(() => {
    setIsPinned(prev => !prev);
  }, []);

  const {
    handleSendMessage,
    handleKeyDown,
    handleNewChat,
    handleRegenerate,
    handleCopy,
    handleFeedback,
    handleShare,
    handleNavigation,
    handleAttachment,
    handleScreenshot,
  } = useChatHandlers(messages, setMessages, message, setMessage, isLoading, setIsLoading, chatRef);

  return (
    <div className={`flex h-screen ${theme.bgColor} ${theme.textColor} font-sans relative overflow-hidden`}>
      {/* Hover Menu Button */}
      <div 
        className="fixed top-4 left-4 z-50"
        onMouseEnter={() => setSidebarOpen(true)}
      >
        <div className="p-2 transition-all duration-200 cursor-pointer">
          <LogoIcon />
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        handleNewChat={handleNewChat}
        theme={theme}
        handleNavigation={handleNavigation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col transition-all duration-300 relative" style={{ marginLeft: sidebarOpen ? '16rem' : '0' }}>
        {/* 3-Dot Menu */}
        <div 
            className="absolute top-4 right-6 z-30"
            onMouseEnter={() => setIsMenuOpen(true)}
            onMouseLeave={() => setIsMenuOpen(false)}
        >
            <button className={`p-2 rounded-full ${theme.hoverBg} transition-colors`}>
                <MoreVertical size={20} />
            </button>
            {isMenuOpen && (
                <div className={`absolute top-full right-0 mt-2 w-48 rounded-lg shadow-lg ${theme.messageBg} border ${theme.borderColor} overflow-hidden`}>
                    <ul className="py-1">
                        <li><button onClick={handlePinChat} className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${theme.hoverBg}`}><Pin size={16} className={isPinned ? 'fill-current' : ''}/><span>{isPinned ? 'Unpin Chat' : 'Pin Chat'}</span></button></li>
                        <li><button onClick={handleNewChat} className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${theme.hoverBg}`}><Trash2 size={16} /><span>Delete Chat</span></button></li>
                        <li><button onClick={() => window.location.reload()} className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${theme.hoverBg}`}><RefreshCw size={16} /><span>Reload</span></button></li>
                        <li><button onClick={handleNewChat} className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${theme.hoverBg}`}><Plus size={16} /><span>New Chat</span></button></li>
                    </ul>
                </div>
            )}
        </div>
        
        {/* Header */}
        <div className={`flex items-center justify-center px-6 py-4 border-b ${theme.borderColor} flex-shrink-0`}>
          <button 
            onClick={() => setDarkMode(prev => !prev)}
            className={`font-cinzel text-2xl font-bold tracking-[0.3em] hover:opacity-70 transition-all duration-200 cursor-pointer px-8 py-3 rounded-lg border-2 ${theme.borderColor} shadow-lg ${theme.shadow}`}
          >
            VEDICSTEM
          </button>
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center opacity-50">
                <p className="text-xl mb-2">Welcome to VEDICSTEM</p>
                <p className="text-sm">Start a conversation by typing below</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                msg={msg}
                theme={theme}
                handleRegenerate={handleRegenerate}
                handleCopy={handleCopy}
                handleFeedback={handleFeedback}
                handleShare={handleShare}
              />
            ))
          )}
        </div>

        <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .animate-pulse-fast {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}</style>

        {/* Input Area */}
        <div className={`p-6 flex-shrink-0`}>
          <ChatInput
            message={message}
            setMessage={setMessage}
            handleKeyDown={handleKeyDown}
            handleAttachment={handleAttachment}
            handleSendMessage={handleSendMessage}
            handleScreenshot={handleScreenshot}
            theme={theme}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
