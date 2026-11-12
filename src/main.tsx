import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Protection against Google Translate / browser extensions modifying DOM text nodes
// and causing React's removeChild & insertBefore to throw NotFoundError crashes
try {
  if (typeof Node === 'function' && Node.prototype) {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child.parentNode !== this) {
        if (console && console.warn) {
          console.warn('DOM mutation intercepted: child is not a direct child of parentNode', child, this);
        }
        return child;
      }
      return originalRemoveChild.apply(this, [child]) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (console && console.warn) {
          console.warn('DOM mutation intercepted: referenceNode is not a child of parentNode', referenceNode, this);
        }
        return originalInsertBefore.apply(this, [newNode, null]) as T;
      }
      return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
    };
  }
} catch (e) {
  console.warn('Could not patch Node prototype methods:', e);
}

try {
  document.documentElement.classList.remove('theme-neumorphism', 'neu-theme');
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
