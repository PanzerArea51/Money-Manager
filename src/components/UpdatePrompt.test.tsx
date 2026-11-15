import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

const noop = () => {};

describe('UpdatePrompt', () => {
  it('renders Update and Later buttons when visible', () => {
    const html = renderToString(<UpdatePrompt visible onUpdate={noop} onDismiss={noop} />);
    expect(html).toContain('Update');
    expect(html).toContain('Later');
    expect(html).toContain('A new version is available.');
  });

  it('renders nothing when not visible', () => {
    const html = renderToString(
      <UpdatePrompt visible={false} onUpdate={noop} onDismiss={noop} />,
    );
    expect(html).toBe('');
  });
});
