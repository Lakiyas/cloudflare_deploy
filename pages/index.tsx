import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import placeholderMsgsByLocale from '../docs/temporary';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { useSwipeable } from 'react-swipeable';
import { useWindowWidth } from '../utils/hooks/useWindowWidth';
import { useRouter } from 'next/router';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const locale = router.query.locale;
  const currentLocale = typeof locale === 'string' ? locale : 'en-us';
  const windowWidth = useWindowWidth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [ctrl, setCtrl] = useState<AbortController | null>(null);
  const [visibleStartIndex, setVisibleStartIndex] = useState(10);
  const [suggestedMessageClicked, setSuggestedMessageClicked] = useState(false);
  const [isIframe, setIsIframe] = useState(false);


  const initialMessagesByLocale = {
    'en-us': 'Hi, what would you like to learn about NSoft Vision?',
    'hr': 'Pozdrav, što biste željeli naučiti o NSoft Visionu?',
  };
  
  const typingMessagesByLocale = {
    'en-us': 'Assistant is typing...',
    'hr': 'Asistent tipka...',
  };

  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
  }>({
    messages: [
      {
        message: initialMessagesByLocale[currentLocale as keyof typeof initialMessagesByLocale],
        type: 'apiMessage',
      },
    ],
    history: [],
  });

  const { messages, pending, history } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  function updateInitialMessage() {
    setMessageState((state) => ({
      ...state,
      messages: [
        {
          message: initialMessagesByLocale[currentLocale as keyof typeof initialMessagesByLocale],
          type: 'apiMessage',
        },
      ],
    }));
  }
  

  const [placeholderMsgs, setPlaceholderMsgs] = useState<string[]>([]);

  useEffect(() => {
    const localeMessages = placeholderMsgsByLocale[currentLocale as keyof typeof placeholderMsgsByLocale] || [];
    shuffleArray(localeMessages);
    setPlaceholderMsgs(localeMessages);
    updateInitialMessage();
  }, [currentLocale]);
  
  function shuffleArray(array: any) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  

  const handleLeftClick = () => {
    setVisibleStartIndex((prevVisibleStartIndex) => {
      const newIndex = prevVisibleStartIndex + 1;
      if (newIndex >= placeholderMsgs.length) {
        return placeholderMsgs.length;
      } else {
        return newIndex;
      }
    });
  };
  

const handleRightClick = () => {
  setVisibleStartIndex((prevVisibleStartIndex) => {
    const newIndex = prevVisibleStartIndex - 1;
    if (newIndex < 0) {
      return 0;
    } else {
      return newIndex;
    }
  });
};




  function handleSuggestedMessageClick(msg: string) {
    if (!loading) {
      setQuery(msg);
      setSuggestedMessageClicked(true);
    }
  }
  useEffect(() => {
    if (suggestedMessageClicked) {
      handleSubmit({ preventDefault: () => {} });
      setSuggestedMessageClicked(false);
    }
  }, [suggestedMessageClicked]);
  
  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  //handle form submission
  async function handleSubmit(e: any) {
    e.preventDefault();

    setError(null);

    if (!query) {
      setWarning(currentLocale === 'en-us' ? 'Please input a question' : 'Molimo unesite pitanje');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setWarning(null);
      }, 3000);
      return;
    }
    

    const question = query.trim();
    
    if (question === '') {
      setWarning(currentLocale === 'en-us' ? 'Please input a question' : 'Molimo unesite pitanje');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setWarning(null);
      }, 3000);
      return;
    }

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
      pending: undefined,
    }));
    setWarning(null);

    setLoading(true);
    window.parent.postMessage({ status: 'request-started' }, '*');
    setQuery('');
    setMessageState((state) => ({ ...state, pending: '' }));
    shuffleArray(placeholderMsgs);

    const ctrl = new AbortController();
    setCtrl(ctrl); 

    const MAX_HISTORY_ENTRIES = 9;
    const archiveHistory = (history: [string, string][], maxEntries: number): [string, string][] => {
      if (history.length > maxEntries) {
        return history.slice(history.length - maxEntries);
      }
      return history;
    }


  try {
    const response = await fetch('/api/askAssistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        history: archiveHistory(history, MAX_HISTORY_ENTRIES),
        locale,
      }),
    });
  
    if (response.ok) {
      const data = await response.json();
      
    // Post a message to the parent iframe if the status is '[DONE]'
    if (data.status === '[DONE]') {
      window.parent.postMessage({ status: 'request-ended' }, '*');
    }

      setMessageState((state) => ({
        history: [...state.history, [question, data?.assistantMessage ?? '']],
        messages: [
          ...state.messages,
          {
            type: 'apiMessage',
            message: data?.assistantMessage ?? '',
          },
        ],
        pending: undefined,
      }));
    } else {
      setError('An error occurred while fetching the data. Please try again.');
    }
  
    setLoading(false);
  } catch (error) {
    setLoading(false);
    setError('An error occurred while fetching the data. Please try again.');
    console.log('error', error);
  }
}
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleLeftClick(),
    onSwipedRight: () => handleRightClick(),
    trackMouse: false,
  });

  function handleStop() {
    if (ctrl) {
      ctrl.abort();
      window.parent.postMessage({ status: 'request-aborted' }, '*');  // Notify the parent window that the request has aborted by the user
      setLoading(false);
      setCtrl(null);
      setMessageState((state) => ({ ...state, pending: undefined }));
      setError(null);
  
      // Clear the timeout when user manually stops the response
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    }
  }
  
  //prevent empty submissions
    const handleEnter = useCallback(
      (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (query) {
            handleSubmit(e);
          } else {
            e.preventDefault();
          }
        } else if (e.key === 'Enter' && e.shiftKey) {
          // Allow Shift+Enter to create a new line
          // e.target.value += '\n';
          e.preventDefault();
        }
      },
      [query],
    );
    

  const chatMessages = useMemo(() => {
    return [
      ...messages,
      ...(pending
        ? [
            {
              type: 'apiMessage',
              message: pending,
            },
          ]
        : []),
    ];
  }, [messages, pending]);

  useEffect(() => {
    if (!loading) {
      textAreaRef.current?.focus();
    }
  }, [loading]);
  

  //scroll to bottom of chat
  useEffect(() => {
    if (windowWidth && windowWidth > 767) {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
   } else {
      if (messageListRef.current) {
        messageListRef.current.scrollTo({
          top: messageListRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [chatMessages]);

  
  useEffect(() => {
    if (window.self !== window.top) {
      // The page is being loaded inside an iframe
      setIsIframe(true);
    }
  }, []);

  
  return (
    <>
      <Layout>
        <div className={`mx-auto ${error ? '' : 'gap-4'} flex flex-col ${isIframe ? '' : 'hide-when-not-in-iframe'}`}>
        {error ? (
              <div className="ml-6 mr-6 rounded-md p-4">
                <p className={(windowWidth && windowWidth > 576 ? "text-sm text-center mx-4" : "text-xs") + " text-red-500"}>{error}</p>
              </div>
            ):(<h1 style={{color:"#9d9d9d"}} 
            className={(windowWidth && windowWidth > 576 ? "text-2xl" : "text-lg") + " font-bold leading-[1.1] tracking-tighter text-center"}
            >
            NSoft{windowWidth && windowWidth > 400 && <span style={{ color: '#0091FF' }}>Vision</span>} {currentLocale==='en-us'?<>Customer Support Assistant</>:<>korisnički asistent za podršku</>}
            </h1>)}
          <main className={styles.main}>
            <div className={styles.cloud}>
            <div ref={messageListRef} className={styles.messagelist}>
                {chatMessages.map((message, index) => {
                  let icon;
                  let className;
                  if (message.type === 'apiMessage') {
                    icon = (
                      <Image
                        src="/favicon.png"
                        alt="AI"
                        width="40"
                        height="40"
                        className={styles.boticon}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                        priority
                      />
                    );
                    className = styles.apimessage;
                  } else {
                    icon = (
                      <Image
                        src="/user.png"
                        alt="Me"
                        width="30"
                        height="30"
                        className={styles.usericon}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                        priority
                      />
                    );
                    // animate the latest user message whilst waiting for a response
                    className =
                      loading && index === chatMessages.length - 1
                        ? styles.usermessagewaiting
                        : styles.usermessage;
                  }
                  return (
                    <>
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className={styles.markdownanswer}>
                          <ReactMarkdown linkTarget="_blank">
                            {message.message}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </>
                  );
                })}
                {!loading &&
                  <div className="flex items-center">
                    {windowWidth && windowWidth > 420 && <button className="select-none	bg-gray-200 text-gray-800 py-2 px-4 m-2 rounded-lg" onClick={handleLeftClick}>❮</button>}
                    <div className="flex overflow-hidden">
                      <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${visibleStartIndex * 100}px)` }}{...swipeHandlers}>
                        {placeholderMsgs.map((msg, index) => (
                          <div
                            key={`suggestedMessage-${index}`}
                            className="flex-none bg-gray-200 text-gray-800 py-2 px-4 m-2 rounded-lg whitespace-nowrap cursor-pointer"
                            onClick={() => handleSuggestedMessageClick(msg)}
                          >
                            {msg}
                          </div>
                        ))}
                      </div>
                    </div>
                    {windowWidth && windowWidth > 420 && <button className="select-none	bg-gray-200 text-gray-800 py-2 px-4 m-2 rounded-lg" onClick={handleRightClick}>❯</button>}
                  </div>}
              </div>
            </div>
            <div className={styles.center}>
            {warning && !loading && ( <a style={{userSelect:"none", marginBottom:20, marginRight:20, zIndex:10,position:"absolute", right:"0%",bottom:"100%",backgroundColor: "#f9f9f9", color: "gray", border: "1px solid gray", borderRadius: "5px", padding: "10px", boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.1)", cursor:"default"}} > {warning} </a> )}
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading}
                    onKeyDown={handleEnter}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                    ? typingMessagesByLocale[currentLocale as keyof typeof typingMessagesByLocale] :
                    currentLocale==='en-us'?"Any question about Vision? Type it here...":"Imate pitanje o Visionu? Upitajte ovdje..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.textarea}
                  />
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.generatebutton}
                    // adding margin right 10px for send message button so it can be more comfy since we had some extra space because the microphone and STT functionality was temporarily disabled
                    style={{zIndex:999, marginRight:10 }}
                  >
                    {/* {loading && <a style={{ display: "inline", transform: 'translate(-0%, -15%)', zIndex: 10, marginRight:windowWidth && windowWidth > 400 ? 35 : 25 , backgroundColor: '#272727', borderRadius: '5px', border: 'none', color: 'white', padding: '6px 12px', cursor: 'pointer', }} type="button" onClick={handleStop} > 🟦 Stop </a>} */}
                    {loading ? (
                      <div className={styles.loadingwheel}>
                        <LoadingDots color="#000" />
                      </div>
                    ) : (
                      // `Send` icon SVG in input field
                      <svg
                        viewBox="0 0 20 20"
                        className={styles.svgicon}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </main>
        </div>
      </Layout>
    </>
  );
}
