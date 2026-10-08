import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MissionsAdmin } from './missions-admin';

describe('MissionsAdmin', () => {
  let component: MissionsAdmin;
  let fixture: ComponentFixture<MissionsAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MissionsAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(MissionsAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
