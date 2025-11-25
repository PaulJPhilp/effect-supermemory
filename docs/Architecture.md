

## `effect-supermemory` Architecture

This diagram illustrates the system flow from the consumer (Agent or App) down to the external Supermemory API, highlighting the role of the Effect runtime in managing the "untrusted" boundaries.

```mermaid
graph TB
    subgraph Consumer ["Consumer Layer (Agent / App)"]
        Agent[AI Agent / App]
        ToolCall[Agent Tool Call]
    end

    subgraph EffectSupermemory ["@paulphilp/effect-supermemory"]
        
        subgraph HighLevel ["Service Layer (Domain Logic)"]
            Tools[Tools Module]
            Ingest[Ingest Service]
            Search[Search Service]
            Profile[Profile Service]
        end

        subgraph CoreLogic ["Core Logic & Validation"]
            FilterBuilder[Fluent Filter Builder]
            SchemaVal[Schema Validation]
            ErrorMap[Error Mapping]
        end

        subgraph Infrastructure ["Infrastructure Layer"]
            Client[Supermemory HTTP Client]
            Config[Config & Secrets]
            Telemetry[Effect Tracer / Metrics]
        end

    end

    subgraph External ["External System"]
        SuperAPI[Supermemory.ai API]
    end

    %% Data Flow
    Agent -->|"Calls (remember/recall)"| Tools
    Agent -->|"Direct Usage"| Ingest
    Agent -->|"Direct Usage"| Search

    Tools --> Search
    Tools --> Ingest

    Ingest --> SchemaVal
    Search --> SchemaVal
    Profile --> SchemaVal

    SchemaVal -->|"Valid Request"| Client
    SchemaVal -.->|"Invalid Input"| ErrorMap

    Client -->|"Signed Request"| SuperAPI
    
    %% Config & Telemetry wiring
    Config --> Client
    Telemetry -.->|"Spans"| Client
    Telemetry -.->|"Spans"| Search

    %% Error Propagation
    SuperAPI -.->|"4xx/5xx Response"| Client
    Client -.->|"Raw Error"| ErrorMap
    ErrorMap -.->|"Typed Effect Error"| Search
    ErrorMap -.->|"Typed Effect Error"| Ingest

    %% Styling
    classDef effect fill:#2b2b2b,stroke:#e0e0e0,color:#e0e0e0;
    classDef external fill:#f9f9f9,stroke:#333,stroke-width:2px,color:#333;
    
    class EffectSupermemory effect;
    class SuperAPI external;
```

### Key Architectural Insights from Diagram:

1.  **The "Schema Firewall":** Note how `Schema Validation` sits between the Service Layer and the Client. Nothing leaves the library without being validated against the domain model. This prevents sending garbage to the API.
2.  **Typed Error Propagation:** The `Error Mapping` module is critical. It converts raw HTTP errors (429, 500) into actionable Effect errors (`SupermemoryRateLimitError`), which bubble up to the agent for intelligent handling (e.g., "I should wait before retrying").
3.  **Tool Abstraction:** The `Tools` module is a distinct adapter. It simplifies the complex `Search Service` into a format an LLM can understand ("Here is a function called `search_memory`"), bridging the gap between code and cognition.
4.  **Observability First:** Telemetry isn't a sidecar; it's woven into the Client and Search layers, ensuring that every memory operation is traceable in a distributed trace.