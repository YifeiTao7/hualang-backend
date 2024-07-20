-- Drop existing tables and types if they exist
DROP TABLE IF EXISTS Company_Artists CASCADE;
DROP TABLE IF EXISTS Notifications CASCADE;
DROP TABLE IF EXISTS Exhibitions CASCADE;
DROP TABLE IF EXISTS Artworks CASCADE;
DROP TABLE IF EXISTS Artists CASCADE;
DROP TABLE IF EXISTS Companies CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS Sales CASCADE;
DROP TABLE IF EXISTS Sales_Analysis CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP TYPE IF EXISTS membership_type CASCADE;
DROP TYPE IF EXISTS artwork_theme CASCADE;

-- Create enum types
CREATE TYPE user_role AS ENUM ('artist', 'company');
CREATE TYPE notification_type AS ENUM ('invitation', 'message', 'alert', 'exhibition');
CREATE TYPE notification_status AS ENUM ('pending', 'read', 'accepted', 'declined');
CREATE TYPE membership_type AS ENUM ('trial', 'monthly', 'yearly');
CREATE TYPE artwork_theme AS ENUM ('花鸟', '山水', '人物', '书法');

-- Create Users table
CREATE TABLE IF NOT EXISTS Users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    resetToken VARCHAR(255),
    resetTokenExpiration TIMESTAMP
);

-- Create Companies table
CREATE TABLE IF NOT EXISTS Companies (
    userid INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(20),
    membership membership_type DEFAULT 'trial',
    membershipStartDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    membershipEndDate TIMESTAMP,
    totalSalesVolume INTEGER DEFAULT 0, -- 新增字段
    totalSalesAmount DECIMAL(10, 2) DEFAULT 0.00, -- 新增字段
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES Users(id)
);

-- Create Artists table
CREATE TABLE IF NOT EXISTS Artists (
    userid INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    weChat VARCHAR(255),
    qq VARCHAR(255),
    companyId INTEGER,
    avatar VARCHAR(255),
    exhibitionsHeld INTEGER DEFAULT 100,
    bio TEXT DEFAULT '',
    signPrice DECIMAL(10, 2) DEFAULT 0.00,
    settledAmount DECIMAL(10, 2) DEFAULT 0.00,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES Users(id),
    FOREIGN KEY (companyId) REFERENCES Companies(userid)
);


-- Create Artworks table
CREATE TABLE IF NOT EXISTS Artworks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    theme artwork_theme NOT NULL,
    creationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    artistId INTEGER NOT NULL,
    imageUrl VARCHAR(255) NOT NULL,
    isSold BOOLEAN DEFAULT FALSE,
    salePrice DECIMAL(10, 2),
    saleDate TIMESTAMP,
    serialNumber INTEGER NOT NULL,
    size VARCHAR(255) NOT NULL,
    isAwardWinning BOOLEAN DEFAULT FALSE,
    awardDetails TEXT,
    isPublished BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artistId) REFERENCES Artists(userid)
);

-- Create Sales table
CREATE TABLE IF NOT EXISTS Sales (
    id SERIAL PRIMARY KEY,
    artworkId INTEGER NOT NULL,
    artistId INTEGER NOT NULL,
    companyId INTEGER NOT NULL,
    salePrice DECIMAL(10, 2) NOT NULL, -- 卖出价
    artistPayment DECIMAL(10, 2) NOT NULL, -- 支付给画家的钱
    profit DECIMAL(10, 2) NOT NULL, -- 盈利
    saleDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artworkId) REFERENCES Artworks(id),
    FOREIGN KEY (artistId) REFERENCES Artists(userid),
    FOREIGN KEY (companyId) REFERENCES Companies(userid)
);

-- Create Exhibitions table
CREATE TABLE IF NOT EXISTS Exhibitions (
    id SERIAL PRIMARY KEY,
    artistuserid INTEGER NOT NULL,
    artworkCount INTEGER NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    companyId INTEGER NOT NULL,
    FOREIGN KEY (artistuserid) REFERENCES Users(id),
    FOREIGN KEY (companyId) REFERENCES Companies(userid)
);

-- Create Notifications table
CREATE TABLE IF NOT EXISTS Notifications (
    id SERIAL PRIMARY KEY,
    senderId INTEGER NOT NULL,
    receiverId INTEGER NOT NULL,
    type notification_type NOT NULL,
    status notification_status DEFAULT 'pending',
    content TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senderId) REFERENCES Users(id),
    FOREIGN KEY (receiverId) REFERENCES Users(id)
);

-- Create junction table for many-to-many relationship between Companies and Artists
CREATE TABLE IF NOT EXISTS Company_Artists (
    companyuserid INTEGER,
    artistuserid INTEGER,
    PRIMARY KEY (companyuserid, artistuserid),
    FOREIGN KEY (companyuserid) REFERENCES Users(id),
    FOREIGN KEY (artistuserid) REFERENCES Users(id)
);

-- Create Sales_Analysis table for hot sale themes and sizes by month
CREATE TABLE IF NOT EXISTS Sales_Analysis (
    id SERIAL PRIMARY KEY,
    companyId INTEGER NOT NULL,
    periodType VARCHAR(10) NOT NULL, -- 'week', 'month', 'year'
    period TIMESTAMP NOT NULL,
    theme artwork_theme NOT NULL,
    size VARCHAR(255),
    salesCount INTEGER NOT NULL,
    salesAmount DECIMAL(10, 2) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES Companies(userid)
);

CREATE INDEX idx_artworks_artistid ON Artworks(artistId);
CREATE INDEX idx_sales_artistid ON Sales(artistId);
CREATE INDEX idx_sales_companyid ON Sales(companyId);
-- 添加唯一约束到 Sales 表
ALTER TABLE Sales ADD CONSTRAINT unique_artworkId UNIQUE (artworkId);
