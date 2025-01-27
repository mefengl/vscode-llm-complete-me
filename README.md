# LLM Complete Me

<a href="https://marketplace.visualstudio.com/items?itemName=mefengl.llm-compelete-me" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/mefengl.llm-compelete-me.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>

## Configurations

<!-- configs -->
| Key                           | Description                                                        | Type          | Default                       |
| ----------------------------- | ------------------------------------------------------------------ | ------------- | ----------------------------- |
| `llm-compelete-me.baseURL`    | LLM Provider Base URL (OpenAI Comppatible)                         | `string,null` | `"https://api.openai.com/v1"` |
| `llm-compelete-me.apiKey`     | LLM Provider API Key                                               | `string,null` | `""`                          |
| `llm-compelete-me.model`      | Model to be used                                                   | `string,null` | `"o1-mini"`                   |
| `llm-compelete-me.useCopilot` | Use github copilot, recommend when having copilot pro subscription | `boolean`     | `false`                       |
<!-- configs -->

## Commands

<!-- commands -->
| Command                   | Title                   |
| ------------------------- | ----------------------- |
| `llm-compelete-me.please` | LLM Compelete Me Please |
<!-- commands -->

## Credits

- [YouCompleteMe](https://github.com/ycm-core/YouCompleteMe): For the lovely way of naming
- [starter-vscode](https://github.com/antfu/starter-vscode): Built on this helpful template
  > Licensed under the [MIT License](https://github.com/antfu/starter-vscode/blob/f97726ca995afa899da954fe74fc9ea5df618fd9/LICENSE.md)

## License

[MIT](./LICENSE)
