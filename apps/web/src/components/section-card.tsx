'use client';

import { Card } from '@heroui/react';

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="default">
      <Card.Header>
        <Card.Title className="text-xl font-semibold" render={(props) => <h2 {...props} />}>
          {title}
        </Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}
