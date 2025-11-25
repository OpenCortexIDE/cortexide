import React, { useCallback, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// This will be replaced with a new communication mechanism
const vscode = {
    postMessage: (message: any) => {
        // In a real browser environment, this would be `window.vscode.postMessage`
        console.log("Message to workbench:", message);
        window.postMessage(message, '*');
    }
};

const App = () => {
    const [state, setState] = useState<any>(null);
    const [inputText, setInputText] = useState("");

    useEffect(() => {
        const handleMessage = (event: any) => {
            const message = event.data;
            if (message.type === 'state') {
                setState(message.state);
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const handleStartTask = () => {
        vscode.postMessage({ type: 'startTask', text: inputText });
    };

    if (!state) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Cortex IDE Agent</h1>
            {/* We will add the chat history here */}

            <div style={{ position: 'absolute', bottom: 0, width: '100%' }}>
                <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    style={{ width: '80%', height: '50px' }}
                />
                <button onClick={handleStartTask} style={{ width: '20%' }}>Send</button>
            </div>
        </div>
    )
}

const queryClient = new QueryClient()

const AppWithProviders = () => (
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>
)

export default AppWithProviders
