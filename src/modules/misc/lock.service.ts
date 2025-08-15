import { Injectable, Logger } from "@nestjs/common"
import { Network } from "@/modules/common"

@Injectable()
export class LockService {
    private logger = new Logger(LockService.name)
    private locks = new Map<string, Set<Network>>()

    /** Check and acquire lock */
    private acquire(key: string, network: Network): boolean {
        if (!this.locks.has(key)) {
            this.locks.set(key, new Set())
        }
        const set = this.locks.get(key)!
        if (set.has(network)) return false
        set.add(network)
        return true
    }

    private release(key: string, network: Network) {
        this.locks.get(key)?.delete(network)
    }

    /**
   * With lock
   */
    async withLocks({
        blockedKeys,
        acquiredKeys,
        releaseKeys,
        network,
        callback,
    }: WithLockParams): Promise<void> {
        // if blocked keys is not empty, we will block all keys
        for (const blockKey of blockedKeys) {
            if (this.isLocked(blockKey, network)) {
                this.logger.debug(
                    `This execution is blocked with ${blockKey}`,
                )
                return
            }
        }
        // try acquire all keys
        for (const acquiredKey of acquiredKeys) {
            this.acquire(acquiredKey, network)
        }
        try {
            await callback()
        } finally {
            // release all keys
            for (const releaseKey of releaseKeys) this.release(releaseKey, network)
        }
    }

    /** Check if lock is held */
    isLocked(key: string, network: Network): boolean {
        return this.locks.get(key)?.has(network) ?? false
    }
}

export interface WithLockParams {
  // the keys you want to block
  blockedKeys: Array<string>;
  // the keys you want to acquired
  acquiredKeys: Array<string>;
  // the keys you want to release
  releaseKeys: Array<string>;
  network: Network;
  callback: () => Promise<void> | void;
}
