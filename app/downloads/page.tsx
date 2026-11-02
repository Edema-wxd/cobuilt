import { permanentRedirect } from 'next/navigation';

/**
 * `/downloads` — the address the design handover named for the download
 * centre. The centre is part of `/resources`, so this sends visitors there.
 */
export default function Downloads(): never {
  permanentRedirect('/resources#downloads');
}
