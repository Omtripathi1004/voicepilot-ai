// VoicePilot AI — Comprehensive Technical Knowledge Base & Conversational Reasoner

export interface KnowledgeEntry {
  patterns: RegExp[];
  topic: string;
  answer: string;
}

export const TECHNICAL_KNOWLEDGE: KnowledgeEntry[] = [
  // --- Data Structures ---
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?data\s+structure\b/i, /\bdata\s+structure(s)?\b/i],
    topic: 'Data Structure',
    answer: 'A data structure is a specialized format for organizing, storing, and managing data efficiently in computer memory. Common examples include arrays, linked lists, stacks, queues, trees, and hash tables.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(an\s+)?array\b/i, /\barray(s)?\b/i],
    topic: 'Array',
    answer: 'An array is a linear data structure that stores a collection of elements of the same data type in contiguous memory locations. Elements can be accessed directly in O(1) constant time using their numerical index.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?linked\s+list\b/i, /\blinked\s+list(s)?\b/i],
    topic: 'Linked List',
    answer: 'A linked list is a linear data structure composed of nodes, where each node contains a data value and a pointer reference to the next node in the sequence. Unlike arrays, nodes do not require contiguous memory.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?stack\b/i, /\bstack(s)?\b/i],
    topic: 'Stack',
    answer: 'A stack is a linear data structure that follows the Last In, First Out (LIFO) principle. Elements can only be inserted or removed from the top using push and pop operations, both executing in O(1) time.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?queue\b/i, /\bqueue(s)?\b/i],
    topic: 'Queue',
    answer: 'A queue is a linear data structure that follows the First In, First Out (FIFO) principle. Elements are enqueued at the back and dequeued from the front, commonly used in task scheduling and breadth-first search.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?hash\s*(table|map)\b/i, /\bhash\s*(table|map)(s)?\b/i],
    topic: 'Hash Table',
    answer: 'A hash table, or hash map, is an associative data structure that maps keys to values using a hashing function. It provides average-case constant time O(1) complexity for search, insertion, and deletion.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?tree\b/i, /\bbinary\s+tree\b/i, /\bbst\b/i],
    topic: 'Tree Data Structure',
    answer: 'A tree is a non-linear, hierarchical data structure consisting of nodes connected by edges, starting from a root node. A Binary Search Tree maintains keys where left child nodes are smaller and right child nodes are larger, enabling O(log N) operations.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(a\s+)?graph\b/i, /\bgraph\s+structure\b/i],
    topic: 'Graph',
    answer: 'A graph is a non-linear data structure consisting of a set of vertices or nodes connected by edges. Graphs can be directed or undirected, weighted or unweighted, and are essential for modeling networks and relationships.',
  },

  // --- Algorithms & Programming Concepts ---
  {
    patterns: [/\b(what is|define|explain)\s+recursion\b/i, /\brecursive\b/i],
    topic: 'Recursion',
    answer: 'Recursion is a programming technique where a function calls itself directly or indirectly to solve smaller instances of the same problem, continuing until it reaches a defined base case.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(big\s*o|time\s+complexity|space\s+complexity)\b/i],
    topic: 'Big-O Notation',
    answer: 'Big-O notation describes the upper bound of an algorithm\'s runtime or space requirements as the input size grows, measuring asymptotic efficiency such as O(1), O(log N), O(N), or O(N squared).',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(binary\s+search)\b/i],
    topic: 'Binary Search',
    answer: 'Binary search is an efficient search algorithm on sorted arrays that repeatedly divides the search interval in half, achieving logarithmic time complexity of O(log N).',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(oop|object\s+oriented\s+programming)\b/i],
    topic: 'Object-Oriented Programming',
    answer: 'Object-Oriented Programming (OOP) is a programming paradigm based on the concept of objects containing data in fields and code in methods. Its four core pillars are encapsulation, abstraction, inheritance, and polymorphism.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(polymorphism)\b/i],
    topic: 'Polymorphism',
    answer: 'Polymorphism allows objects of different classes to be treated as instances of a common superclass, enabling method overriding at runtime and method overloading at compile time.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(rest|restful\s+api)\b/i],
    topic: 'REST API',
    answer: 'REST, or Representational State Transfer, is an architectural style for distributed systems using standard HTTP methods like GET, POST, PUT, and DELETE to perform stateless operations on resources.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(websocket(s)?)\b/i],
    topic: 'WebSocket',
    answer: 'A WebSocket is a computer communications protocol providing full-duplex, bidirectional communication channels over a single persistent TCP connection, crucial for real-time audio and chat applications.',
  },

  // --- VoicePilot & Speech Technology ---
  {
    patterns: [/\b(what is|define|explain)\s+(ttfa|time\s+to\s+first\s+audio)\b/i],
    topic: 'TTFA',
    answer: 'Time-to-first-audio (TTFA) measures the latency in milliseconds from when a user finishes speaking to when the first synthesized audio chunk is delivered. VoicePilot achieves sub-150 millisecond TTFA using Rime streaming.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(generation\s+fencing|fencing)\b/i],
    topic: 'Generation Fencing',
    answer: 'Generation fencing is a synchronization technique where every user utterance increments a monotonic generation counter. If the user interrupts, all in-flight synthesis and tool results tagged with previous generation IDs are rejected immediately, preventing audio bleed.',
  },
  {
    patterns: [/\b(what is|define|explain)\s+(barge\s*in|interruption)\b/i],
    topic: 'Barge-In',
    answer: 'Barge-in allows a user to interrupt the agent mid-speech. VoicePilot cancels audio playback instantly, flushes the synthesis buffer, and smoothly adopts the new user intent.',
  },
];

export function lookupTechnicalAnswer(query: string): string | null {
  const clean = query.trim();
  for (const entry of TECHNICAL_KNOWLEDGE) {
    for (const pattern of entry.patterns) {
      if (pattern.test(clean)) {
        return entry.answer;
      }
    }
  }

  // Fallback term matching
  const lower = clean.toLowerCase();
  for (const entry of TECHNICAL_KNOWLEDGE) {
    const topicWords = entry.topic.toLowerCase().split(' ');
    if (topicWords.some((w) => lower.includes(w) && w.length > 3)) {
      return entry.answer;
    }
  }

  return null;
}
