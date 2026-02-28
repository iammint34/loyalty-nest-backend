-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `pos_transaction_ref` VARCHAR(191) NOT NULL,
    `order_amount` DECIMAL(10, 2) NOT NULL,
    `points_earned` INTEGER NOT NULL DEFAULT 0,
    `branch_code` VARCHAR(191) NULL,
    `items` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `promotion_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transactions_pos_transaction_ref_key`(`pos_transaction_ref`),
    INDEX `transactions_customer_id_idx`(`customer_id`),
    INDEX `transactions_status_idx`(`status`),
    INDEX `transactions_branch_code_idx`(`branch_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `transaction_id` VARCHAR(191) NOT NULL,
    `scanned_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `qr_codes_code_key`(`code`),
    UNIQUE INDEX `qr_codes_transaction_id_key`(`transaction_id`),
    INDEX `qr_codes_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_codes` ADD CONSTRAINT `qr_codes_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
