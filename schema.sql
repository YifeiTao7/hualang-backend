-- Drop existing tables and types if they exist
DROP TABLE IF EXISTS Company_Artists CASCADE;
DROP TABLE IF EXISTS Notifications CASCADE;
DROP TABLE IF EXISTS Exhibitions CASCADE;
DROP TABLE IF EXISTS Artworks CASCADE;
DROP TABLE IF EXISTS Artists CASCADE;
DROP TABLE IF EXISTS Companies CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP TYPE IF EXISTS membership_type CASCADE;

-- Create enum types
CREATE TYPE user_role AS ENUM ('artist', 'company');
CREATE TYPE notification_type AS ENUM ('invitation', 'message', 'alert', 'exhibition');
CREATE TYPE notification_status AS ENUM ('pending', 'read', 'accepted', 'declined');
CREATE TYPE membership_type AS ENUM ('trial', 'monthly', 'yearly');

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
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES Users(id),
    FOREIGN KEY (companyId) REFERENCES Companies(userid)
);

-- Create Artworks table
CREATE TABLE IF NOT EXISTS Artworks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    creationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    artistId INTEGER NOT NULL,
    estimatedPrice DECIMAL(10, 2) NOT NULL,
    imageUrl VARCHAR(255) NOT NULL,
    isSold BOOLEAN DEFAULT FALSE,
    salePrice DECIMAL(10, 2),
    saleDate TIMESTAMP,
    serialNumber INTEGER NOT NULL,
    size VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artistId) REFERENCES Artists(userid)
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
