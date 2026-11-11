import type { Preview } from '@storybook/react-vite'

import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'ink',
      values: [
        { name: 'ink', value: '#07150f' },
        { name: 'court', value: '#0c3b2a' },
      ],
    },
    a11y: {
      test: 'todo',
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-40 bg-ink p-6 text-line">
        <Story />
      </div>
    ),
  ],
}

export default preview
