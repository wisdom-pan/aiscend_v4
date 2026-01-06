import { createContext } from 'react'
import { IMAGE_MODELS } from '../constants'
import { IThemeContext, IAppContext } from '../types'
import { ILLUSION_DIFFUSION_IMAGES} from '../constants'

const ThemeContext = createContext<IThemeContext>({
  theme: {},
  setTheme: () => null,
  themeName: ''
})

const AppContext = createContext<IAppContext>({
  imageModel: IMAGE_MODELS.fastImage.label,
  illusionImage: ILLUSION_DIFFUSION_IMAGES.tinyCheckers.label,
  setImageModel: () => null,
  closeModal: () => null,
  setIllusionImage: () => null
})

export {
  ThemeContext, AppContext
}