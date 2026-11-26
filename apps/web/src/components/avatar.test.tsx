import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it('shows initials placeholder when there is no avatar', () => {
    render(<Avatar username="bob_smith" />);
    expect(screen.getByText('BS')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /bob_smith/ })).toBeInTheDocument();
  });

  it('shows the placeholder when avatarUrl is null', () => {
    render(<Avatar username="bob" userId={7} avatarUrl={null} />);
    expect(screen.getByText('BO')).toBeInTheDocument();
  });

  it('shows the avatar image with alt text when there is one', () => {
    render(<Avatar username="bob" userId={7} avatarUrl="/users/7/avatar" />);
    const img = screen.getByRole('img', { name: 'Avatar of bob' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/api/users/7/avatar');
    expect(screen.queryByText('BO')).not.toBeInTheDocument();
  });
});
