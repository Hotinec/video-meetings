'use client';

import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { LogOutIcon } from '@/components/icons';
import { logoutUser } from '@/lib/auth';

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <Button variant="secondary" size="lg" onPress={handleLogout} isDisabled={isLoading}>
      {isLoading ? <Spinner size="sm" color="current" /> : <LogOutIcon />}
      Log Out
    </Button>
  );
}
