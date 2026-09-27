import { ErrorScreen } from '@/components/StatusScreen';

export default function ServerError() {
  return <ErrorScreen statusCode={500} />;
}
