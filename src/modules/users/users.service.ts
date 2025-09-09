import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { hashPasswordHelper } from '@/helpers/util';
import aqp from 'api-query-params';
import { CreateAuthDto } from '@/auth/dto/create-auth.dto';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async checkExistedUser(email: string) {
    const user = await this.userModel.exists({ email });
    if (user) return true;
    return false;
  }

  async create(createUserDto: CreateUserDto) {
    // Check existed user
    const isExistedUser = await this.checkExistedUser(createUserDto.email);
    if (isExistedUser) {
      throw new BadRequestException('Email is already registered');
    }

    // Hash password
    const hashedPassword = await hashPasswordHelper(createUserDto.password);
    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });

    // Save to db
    await createdUser.save();

    return {
      id: createdUser._id,
    };
  }

  async findAll(query: string, current: number, pageSize: number) {
    const { filter, sort } = aqp(query);

    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const skip = (current - 1) * pageSize;

    const result = await this.userModel
      .find(filter)
      .skip(skip)
      .limit(pageSize)
      .select('-password')
      .sort(sort as any);
    return { result, totalPages };
  }

  findOne(id: string) {
    return this.userModel.findById(id).select('-password');
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email });
  }

  async update(updateUserDto: UpdateUserDto) {
    return await this.userModel.updateOne(
      { _id: updateUserDto._id },
      { ...updateUserDto },
    );
  }

  async remove(_id: string) {
    // Check id
    if (mongoose.isValidObjectId(_id)) {
      return await this.userModel.deleteOne({ _id });
    } else {
      throw new BadRequestException('Invalid ID');
    }
  }

  async handleRegister(registerDto: CreateAuthDto) {
    // Check existed user
    const isExistedUser = await this.checkExistedUser(registerDto.email);
    if (isExistedUser) {
      throw new BadRequestException('Email is already registered');
    }

    // Hash password
    const hashedPassword = await hashPasswordHelper(registerDto.password);
    const createdUser = new this.userModel({
      ...registerDto,
      codeId: uuidv4(),
      codeExpired: dayjs().add(5, 'minutes'),
      password: hashedPassword,
    });

    // Save to db
    await createdUser.save();

    // return request info
    return {
      id: createdUser._id,
    };
  }
}
