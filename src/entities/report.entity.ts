import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("reports")
export class Report {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "varchar", length: 80 }) roomId: string;
  @Column({ type: "varchar", length: 80 }) reporterSocketId: string;
  @Column({ type: "varchar", length: 120 }) reason: string;
  @CreateDateColumn() createdAt: Date;
}
