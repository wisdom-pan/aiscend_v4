import { AnthropicIcon } from './src/components/AnthropicIcon'
import { CohereIcon } from './src/components/CohereIcon'
import { OpenAIIcon } from './src/components/OpenAIIcon'
import { MistralIcon } from './src/components/MistralIcon'
import { GeminiIcon } from './src/components/GeminiIcon'

export const DOMAIN = 'https://yunwu.ai/v1'

// API Keys - 直接硬编码,避免环境变量在 release 模式下的问题
export const API_KEYS = {
  OPENAI: 'sk-ORS9JAXURvGyG3PqAZ3GzsKv8KQ1wJaDjhNM1NOY6eMMx5uM',
  GEMINI: 'sk-ORS9JAXURvGyG3PqAZ3GzsKv8KQ1wJaDjhNM1NOY6eMMx5uM',
}

export const API_CONFIG = {
  BASE_URL: 'https://yunwu.ai/v1',
  OPENAI_API_URL: 'https://yunwu.ai/v1/chat/completions',
  GEMINI_API_URL: 'https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent',
  OPENAI_MODEL: 'gemini-3-flash-preview',
  GEMINI_MODEL: 'gemini-3-flash-preview',
}

export const MODELS = {
  gpt: { name: 'GPT 4', label: 'gemini-3-flash-preview', icon: OpenAIIcon },
  gptTurbo: { name: 'GPT Turbo', label: 'gemini-3-flash-preview', icon: OpenAIIcon },
  claude: { name: 'Claude', label: 'claude', icon: AnthropicIcon },
  claudeInstant: { name: 'Claude Instant', label: 'claudeInstant', icon: AnthropicIcon },
  cohere: { name: 'Cohere', label: 'cohere', icon: CohereIcon },
  cohereWeb: { name: 'Cohere Web', label: 'cohereWeb', icon: CohereIcon },
  mistral: { name: 'Mistral', label: 'mistral', icon: MistralIcon },
  gemini: { name: 'Gemini', label: 'gemini', icon: GeminiIcon },
}

export const IMAGE_MODELS = {
  fastImage: { name: 'Fast Image (LCM)', label: 'fastImage' },
  stableDiffusionXL: { name: 'Stable Diffusion XL', label: 'stableDiffusionXL' },
  removeBg:  { name: 'Remove Background', label: 'removeBg' },
  upscale: { name: 'Upscale', label: 'upscale' },
  illusionDiffusion: { name: 'Illusion Diffusion', label: 'illusionDiffusion' },
}

export const ILLUSION_DIFFUSION_IMAGES = {
  tinyCheckers: {
    label: 'tinyCheckers',
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/ultra_checkers.png',
  },
  smallSquares: {
    label: "smallSquares",
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/checkers_mid.jpg'
  },
  mediumSquares: {
    label: "mediumSquares",
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/pattern.png',
  },
  largeSquares: {
    label: 'largeSquares',
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/checkers.png',
  },
  funky: {
    label: 'funky',
    image:  'https://storage.googleapis.com/falserverless/illusion-examples/funky.jpeg',
  },
  stairs: {
    label: 'stairs',
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/cubes.jpeg',
  },
  turkeyFlag: {
    label: 'turkeyFlag',
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/turkey-flag.png'
  },
  indiaFlag: {
    label: 'indiaFlag',
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/india-flag.png'
  },
  usaFlag: {
    label: 'usaFlag',
    image: 'https://storage.googleapis.com/falserverless/illusion-examples/usa-flag.png'
  }
}