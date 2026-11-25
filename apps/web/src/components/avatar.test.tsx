import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it('shows initials placeholder when there is no avatar', () => {
    render(<Avatar username="bob_smith" />);
    expect(screen.getByText('BS')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /bob_smith/ })).toBeInTheDocument();
  });
});
