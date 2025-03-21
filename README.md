<div align="center">

# Aura Code Review



<a name="readme-top"></a>

Aura is an intelligent code review assistant that leverages AI to streamline your GitHub workflow. It automatically analyzes pull requests, suggests improvements, identifies bugs, and generates optimized code—helping developers ship higher quality software faster.
</div>

---

![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=fff)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
![Postgres](https://img.shields.io/badge/Postgres-%23316192.svg?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=000)
![GitHub](https://img.shields.io/badge/GitHub-%23121011.svg?logo=github&logoColor=white)



## Prerequisites
### LLM Keys
- [Mistral](https://mistral.ai)
- [OpenRouter](https://openrouter.ai)
- [Langsmith](https://smith.langchain.com)

### Github App
- [Create a Github App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps)
- Add the following permissions:
    - Read and Write Metadata
    - Read and Write Code
    - Read and Write Pull Requests

### Database
- Any Postgres database with PGVector extension

Add the above keys to the `.env` file

### Enviroment
- Make sure to have [Bun](https://bun.sh) installed

## Setup

1. Clone the repo
```bash
git clone https://github.com/yashraj-n/aura-code-review
```

2. Install dependencies
```bash
bun install
```

3. Run the server
```bash
bun run dev
```

🚀 The Github App will be installed automatically when you run the server.



